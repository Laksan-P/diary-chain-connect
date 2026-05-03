import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/offline_banner.dart';
import 'app_theme.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'passbook_screen.dart';
import 'profile_screen.dart';
import 'notifications_screen.dart';
import 'faq_screen.dart';
import 'support_chat_screen.dart';

import '../providers/preferences_provider.dart';
import '../services/translations.dart';
import '../services/offline_service.dart';
import '../widgets/bouncing_button.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _api = ApiService();
  final _storage = const FlutterSecureStorage();
  final List<int> _history = [0];
  int _currentIndex = 0;
  bool _isLoading = true;
  List<dynamic> _collections = [];
  List<dynamic> _payments = [];
  List<dynamic> _notifications = [];
  Map<String, dynamic> _performance = {};
  Timer? _refreshTimer;
  AuthProvider? _auth;
  bool _isBalanceVisible = true;

  // Badge tracking: stores the count the user last saw
  int _lastSeenCollectionCount = 0;
  int _lastSeenPaymentCount = 0;
  bool _hasNewCollections = false;
  bool _hasNewPayments = false;
  bool _hasUnreadSupport = false;

  @override
  void initState() {
    super.initState();
    _loadSeenCounts();
    _loadCachedData().then((_) => _fetchData());
    _startAutoRefresh();
  }

  Future<void> _loadCachedData() async {
    try {
      final offline = OfflineService();
      final cols = offline.getCachedData('collections');
      final pays = offline.getCachedData('payments');
      final notifs = offline.getCachedData('notifications');

      if (mounted) {
        setState(() {
          if (cols != null) _collections = List<dynamic>.from(cols);
          if (pays != null) _payments = List<dynamic>.from(pays);
          if (notifs != null) _notifications = List<dynamic>.from(notifs);

          _synthesizeNotifications();

          if (_collections.isNotEmpty || _payments.isNotEmpty) {
            _isLoading = false;
          }
        });
      }
    } catch (e) {
      debugPrint("Cache load failed: $e");
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _auth = context.read<AuthProvider>();
  }

  void _startAutoRefresh() {
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (timer) {
      if (mounted && OfflineService().isOnline) {
        _fetchData();
      }
    });
  }

  // ── Badge Management ──
  Future<void> _loadSeenCounts() async {
    try {
      final cCount = await _storage.read(key: 'seen_collection_count');
      final pCount = await _storage.read(key: 'seen_payment_count');
      _lastSeenCollectionCount = int.tryParse(cCount ?? '0') ?? 0;
      _lastSeenPaymentCount = int.tryParse(pCount ?? '0') ?? 0;
    } catch (_) {}
  }

  void _updateBadges() {
    _hasNewCollections = _collections.length > _lastSeenCollectionCount;
    _hasNewPayments = _payments.length > _lastSeenPaymentCount;
  }

  void _clearBadgeForTab(int index) {
    if (index == 1 && _hasNewCollections) {
      _lastSeenCollectionCount = _collections.length;
      _storage.write(
        key: 'seen_collection_count',
        value: _collections.length.toString(),
      );
      setState(() => _hasNewCollections = false);
    } else if (index == 2 && _hasNewPayments) {
      _lastSeenPaymentCount = _payments.length;
      _storage.write(
        key: 'seen_payment_count',
        value: _payments.length.toString(),
      );
      setState(() => _hasNewPayments = false);
    }
  }



  Future<void> _fetchData() async {
    if (!mounted || _auth?.user == null) return;

    // If offline, don't even try to fetch, just use what we have
    if (!OfflineService().isOnline) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    final user = _auth!.user!;
    final farmerId = user['farmerId'];

    // Only show loader if we have NO data yet (first load)
    if (_collections.isEmpty && _payments.isEmpty) {
      setState(() => _isLoading = true);
    }

    try {
      final results = await Future.wait([
        _api.get('/collections?action=list&farmerId=$farmerId'),
        _api.get('/payments?action=list&farmerId=$farmerId'),
        _api.get('/notifications?action=list'),
        _api.get('/support'),
        _api.get('/performance?type=farmer'),
      ]);

      if (!mounted) return;

      setState(() {
        _collections = results[0];
        _payments = results[1];

        final notifs = results[2] as List<dynamic>;
        // Preserve read status from local state
        for (var i = 0; i < notifs.length; i++) {
          final id = notifs[i]['id'].toString();
          final localIdx = _notifications.indexWhere(
            (n) => n['id'].toString() == id,
          );
          if (localIdx != -1 && _notifications[localIdx]['isRead'] == true) {
            notifs[i]['isRead'] = true;
          }
        }
        _notifications = notifs;
        _synthesizeNotifications();

        final supportTickets = results[3] as List<dynamic>;
        _hasUnreadSupport = supportTickets.any((t) => t['is_read_by_user'] == false);

        _performance = results[4] as Map<String, dynamic>;

        _updateBadges();
      });

      // Save to Hive cache for instant loading next time
      final offline = OfflineService();
      await offline.saveCachedData('collections', _collections);
      await offline.saveCachedData('payments', _payments);
      await offline.saveCachedData('notifications', _notifications);
    } catch (e) {
      debugPrint("Fetch data failed: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Generates local notifications for data that exists but has no alert yet
  void _synthesizeNotifications() {
    bool changed = false;
    final locale = Localizations.localeOf(context).languageCode;

    // 1. Check for New Collections
    for (var col in _collections) {
      final date = col['date']?.toString() ?? '';
      final qResult = col['qualityResult']?.toString().toLowerCase() ?? 'pending';
      final reason = col['reason'] ?? col['failureReason'] ?? col['rejectReason'] ?? '';
      
      // Look for a notification about this specific date and collection
      final exists = _notifications.any(
        (n) =>
            (n['message']?.toString().contains(date) ?? false) &&
            (n['type'] == 'quality_result' || n['type'] == 'general'),
      );

      if (!exists) {
        String title = 'Milk Collection Recorded';
        String message = 'Your milk collection on $date has been recorded in the system.';
        
        if (qResult == 'pass') {
          title = 'quality_test_passed_title';
          message = 'quality_test_passed_msg|date:$date';
        } else if (qResult == 'fail') {
          title = 'quality_test_failed_title';
          // Translate common reasons if possible
          String displayReason = reason.toString();
          if (displayReason.toLowerCase().contains('fat')) {
            displayReason = Translations.get('low_fat', locale);
          } else if (displayReason.toLowerCase().contains('snf')) {
            displayReason = Translations.get('low_snf', locale);
          } else if (displayReason.toLowerCase().contains('water')) {
            displayReason = Translations.get('excess_water', locale);
          }
          
          message = 'quality_test_failed_msg|date:$date,reason:$displayReason';
        }

        final localId = 'local-col-${col['id']}';
        _notifications.insert(0, {
          'id': localId,
          'type': 'quality_result',
          'title': title,
          'message': message,
          'createdAt': col['createdAt'] ?? DateTime.now().toIso8601String(),
          'isRead': OfflineService().isLocalNotificationRead(localId),
          'isSynthesized': true,
        });
        changed = true;
      }
    }

    // 2. Check for New Payments
    for (var pay in _payments) {
      final amount = pay['amount']?.toString() ?? '';
      final exists = _notifications.any(
        (n) =>
            (n['message']?.toString().contains(amount) ?? false) &&
            n['type'] == 'payment',
      );

      if (!exists) {
        final localId = 'local-pay-${pay['id']}';
        _notifications.insert(0, {
          'id': localId,
          'type': 'payment',
          'title': 'payment_received_title',
          'message': 'payment_received_msg|amount:$amount,qty:--',
          'createdAt': pay['createdAt'] ?? DateTime.now().toIso8601String(),
          'isRead': OfflineService().isLocalNotificationRead(localId),
          'isSynthesized': true,
        });
        changed = true;
      }
    }

    if (changed) {
      // Sort by date to keep archive tidy
      _notifications.sort(
        (a, b) => DateTime.parse(
          b['createdAt'],
        ).compareTo(DateTime.parse(a['createdAt'])),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final prefs = context.watch<AppPreferences>();
    final locale = prefs.locale.languageCode;

    // Safety guard: If user is null (logging out), don't render the dashboard
    if (user == null) return const Scaffold(body: SizedBox.shrink());

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _buildFintechDashboard(user, prefs),
          PassbookScreen(
            collections: _collections,
            payments: _payments,
            locale: locale,
            isLoading: _isLoading,
            onRefresh: _fetchData,
            onBack: _handleBack,
            mode: 'supply',
          ),
          PassbookScreen(
            collections: _collections,
            payments: _payments,
            locale: locale,
            isLoading: _isLoading,
            onRefresh: _fetchData,
            onBack: _handleBack,
            mode: 'payments',
          ),
          ProfileScreen(
            onBack: _handleBack,
            hasUnreadSupport: _hasUnreadSupport,
          ),
          NotificationsScreen(
            notifications: _notifications,
            isLoading: _isLoading,
            onRefresh: _fetchData,
            onRead: (id) {
              if (id.startsWith('local-')) {
                OfflineService().markLocalNotificationAsRead(id);
              }
              setState(() {
                final index = _notifications.indexWhere(
                  (n) => n['id'].toString() == id,
                );
                if (index != -1) {
                  _notifications[index]['isRead'] = true;
                }
              });
              _fetchData();
            },
            onBack: _handleBack,
            locale: locale,
            userId: user['id']?.toString() ?? '',
            onSupportTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => SupportChatScreen(onBack: () => Navigator.pop(context)),
                ),
              );
            },
          ),
        ],
      ),
      bottomNavigationBar: _buildIntegratedNavBar(locale),
      floatingActionButton: _buildFloatingFaqButton(context),
    );
  }

  Widget _buildFloatingFaqButton(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return BouncingButton(
      onTap: () {
        HapticFeedback.mediumImpact();
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => FaqScreen(onBack: () => Navigator.pop(context)),
          ),
        );
      },
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark 
              ? [AppTheme.primaryLight, AppTheme.primaryLight.withOpacity(0.8)]
              : [AppTheme.primary, AppTheme.primary.withOpacity(0.85)],
          ),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: (isDark ? AppTheme.primaryLight : AppTheme.primary).withOpacity(0.4),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
          border: Border.all(
            color: Colors.white.withOpacity(0.2),
            width: 1.5,
          ),
        ),
        child: const Icon(
          LucideIcons.messageSquare, 
          color: Colors.white, 
          size: 24,
        ),
      ),
    );
  }

  void _onTabTapped(int index) {
    if (_currentIndex == index) return;
    HapticFeedback.lightImpact();
    _clearBadgeForTab(index);
    setState(() {
      _currentIndex = index;
      _history.add(index);
    });
  }

  void _handleBack() {
    HapticFeedback.mediumImpact();
    if (_history.length > 1) {
      setState(() {
        _history.removeLast();
        _currentIndex = _history.last;
      });
    }
  }

  void _showNotifications() {
    HapticFeedback.mediumImpact();
    if (_currentIndex == 4) return;
    setState(() {
      _currentIndex = 4;
      _history.add(4);
    });
  }

  Widget _buildIntegratedNavBar(String locale) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.only(top: 16, bottom: 24),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.white10 : Colors.grey.shade100,
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: _navItem(
              0,
              Icons.home_outlined,
              Icons.home_rounded,
              Translations.get('home', locale),
              showBadge: _notifications.any((n) => n['isRead'] == false),
            ),
          ),
          Expanded(
            child: _navItem(
              1,
              Icons.credit_card_outlined,
              Icons.credit_card_rounded,
              Translations.get('passbook', locale),
              showBadge: _hasNewCollections,
            ),
          ),
          Expanded(
            child: _navItem(
              2,
              Icons.account_balance_wallet_outlined,
              Icons.account_balance_wallet_rounded,
              Translations.get('payments', locale),
              showBadge: _hasNewPayments,
            ),
          ),
          Expanded(
            child: _navItem(
              3,
              Icons.person_outline_rounded,
              Icons.person_rounded,
              Translations.get('profile', locale),
              showBadge: _hasUnreadSupport,
            ),
          ),
        ],
      ),
    );
  }

  Widget _navItem(
    int index,
    IconData outlineIcon,
    IconData solidIcon,
    String label, {
    bool showBadge = false,
  }) {
    bool isActive = _currentIndex == index;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final activeColor = isDark ? Colors.white : AppTheme.primary;
    final inactiveColor = isDark
        ? Colors.white.withValues(alpha: 0.3)
        : Colors.grey.shade600;
    final badgeColor = isDark
        ? const Color(0xFFFFB000)
        : const Color(0xFF1B264F);

    return BouncingButton(
      onTap: () => _onTabTapped(index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedScale(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutBack,
                  scale: isActive ? 1.2 : 1.0,
                  child: Icon(
                    isActive ? solidIcon : outlineIcon,
                    color: isActive ? activeColor : inactiveColor,
                    size: 26,
                  ),
                ),
                if (showBadge)
                  Positioned(
                    right: -4,
                    top: -3,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: badgeColor,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isDark ? AppTheme.surfaceDark : Colors.white,
                          width: 1.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: badgeColor.withValues(alpha: 0.4),
                            blurRadius: 4,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10,
                  color: isActive ? activeColor : inactiveColor,
                  fontWeight: isActive ? FontWeight.w900 : FontWeight.w600,
                  letterSpacing: -0.2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFintechDashboard(user, AppPreferences prefs) {
    final locale = prefs.locale.languageCode;
    final totalBalance = _payments.fold(0.0, (sum, p) {
      return sum + (double.tryParse(p['amount'].toString()) ?? 0.0);
    });

    final now = DateTime.now();
    final currentMonthPayments = _payments.where((p) {
      try {
        final date = DateTime.parse(p['createdAt']);
        return date.month == now.month && date.year == now.year;
      } catch (_) {
        return false;
      }
    });

    final monthlyEarnings = currentMonthPayments.fold(0.0, (sum, p) {
      return sum + (double.tryParse(p['amount'].toString()) ?? 0.0);
    });

    final monthlyLiters = _collections
        .where((c) {
          try {
            final date = DateTime.parse(c['createdAt']);
            return date.month == now.month && date.year == now.year;
          } catch (_) {
            return false;
          }
        })
        .fold(0.0, (sum, c) {
          return sum + (double.tryParse(c['quantity'].toString()) ?? 0.0);
        });

    return SafeArea(
      bottom: false,
      child: Stack(
        children: [
          // Subtle background decoration
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                color: Theme.of(context).brightness == Brightness.dark 
                    ? Colors.white.withValues(alpha: 0.05)
                    : AppTheme.primary.withValues(alpha: 0.03),
                shape: BoxShape.circle,
              ),
            ),
          ),
          SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                OfflineBanner(locale: locale),
                _buildHeader(user, totalBalance, prefs),
                const SizedBox(height: 24),
                _buildSummaryStats(monthlyEarnings, monthlyLiters, locale),
                if (_performance['status'] != null && _performance['status'] != 'Good') ...[
                  const SizedBox(height: 24),
                  _buildPerformanceCard(locale),
                ],
                const SizedBox(height: 32),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    Translations.get('recent_activity', locale),
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                      color: Theme.of(context).brightness == Brightness.dark
                          ? Colors.white
                          : AppTheme.primary,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                  if (_isLoading)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(40),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  else if (_collections.isEmpty && _payments.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(32),
                      child: Center(
                        child: Text(
                          Translations.get('no_records_found', locale),
                          style: TextStyle(color: Colors.grey.withValues(alpha: 0.5)),
                        ),
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        children: [
                          ..._collections
                              .take(3)
                              .map((c) => _fintechCollectionCard(c, locale)),
                          ..._payments
                              .take(2)
                              .map((p) => _fintechPaymentCard(p, locale)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
  }

  Widget _buildPerformanceCard(String locale) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final status = _performance['status'] ?? 'Good';
    final rec = _performance['recommendation'] ?? '';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark 
              ? [const Color(0xFF422006), const Color(0xFF451A03)]
              : [const Color(0xFFFFF7ED), const Color(0xFFFFEDD5)],
          ),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isDark ? const Color(0xFF78350F) : const Color(0xFFFED7AA),
            width: 1.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF97316).withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(LucideIcons.alertTriangle, color: Color(0xFFF97316), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        Translations.get('performance_alert', locale),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: isDark ? const Color(0xFFFFEDD5) : const Color(0xFF7C2D12),
                        ),
                      ),
                      Text(
                        status,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: (isDark ? const Color(0xFFFFEDD5) : const Color(0xFF7C2D12)).withOpacity(0.6),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              rec,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                fontWeight: FontWeight.w500,
                color: isDark ? const Color(0xFFFED7AA) : const Color(0xFF9A3412),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryStats(double earnings, double liters, String locale) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFormat = NumberFormat.currency(
      symbol: 'Rs. ',
      decimalDigits: 0,
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: _summaryCard(
              Translations.get('monthly_earnings', locale),
              currencyFormat.format(earnings),
              LucideIcons.trendingUp,
              Colors.green,
              isDark,
              () => _showMonthlyBreakdown('earnings', locale),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: _summaryCard(
              Translations.get('monthly_liters', locale),
              '${liters.toStringAsFixed(1)} L',
              LucideIcons.droplets,
              Colors.blue,
              isDark,
              () => _showMonthlyBreakdown('liters', locale),
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryCard(
    String title,
    String value,
    IconData icon,
    Color color,
    bool isDark,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.surfaceDark : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isDark
                ? Colors.white.withValues(alpha: 0.05)
                : Colors.grey.shade100,
            width: 1.5,
          ),
          boxShadow: isDark
              ? []
              : [
                  BoxShadow(
                    color: color.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white60 : Colors.grey.shade500,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: isDark ? Colors.white : Colors.black87,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMonthlyBreakdown(String type, String locale) {
    final now = DateTime.now();
    final List<Map<String, dynamic>> history = [];

    for (int i = 0; i < 3; i++) {
      final date = DateTime(now.year, now.month - i, 1);
      final stats = _getStatsForMonth(date.month, date.year);
      history.add({'date': date, 'val': stats[type]});
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _buildMonthlyBreakdownSheet(type, history, locale),
    );
  }

  Map<String, double> _getStatsForMonth(int month, int year) {
    final payments = _payments.where((p) {
      try {
        final date = DateTime.parse(p['createdAt']);
        return date.month == month && date.year == year;
      } catch (_) {
        return false;
      }
    });

    final collections = _collections.where((c) {
      try {
        final date = DateTime.parse(c['createdAt']);
        return date.month == month && date.year == year;
      } catch (_) {
        return false;
      }
    });

    return {
      'earnings': payments.fold(
        0.0,
        (s, p) => s + (double.tryParse(p['amount'].toString()) ?? 0.0),
      ),
      'liters': collections.fold(
        0.0,
        (s, c) => s + (double.tryParse(c['quantity'].toString()) ?? 0.0),
      ),
    };
  }

  Widget _buildMonthlyBreakdownSheet(
    String type,
    List<Map<String, dynamic>> history,
    String locale,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = type == 'earnings' ? Colors.green : Colors.blue;
    final currencyFormat = NumberFormat.currency(
      symbol: 'Rs. ',
      decimalDigits: 2,
    );
    final title = type == 'earnings'
        ? Translations.get('monthly_earnings', locale)
        : Translations.get('monthly_liters', locale);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1F2C) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(40)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: isDark ? Colors.white : Colors.black,
                  letterSpacing: -1,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '3 Months',
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
          ...history.map((item) {
            final date = item['date'] as DateTime;
            final val = item['val'] as double;
            final monthName = DateFormat('MMMM', locale).format(date);
            final displayVal = type == 'earnings'
                ? currencyFormat.format(val)
                : '${val.toStringAsFixed(1)} L';

            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.03)
                      : Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.05)
                        : Colors.grey.shade200,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        type == 'earnings'
                            ? LucideIcons.trendingUp
                            : LucideIcons.droplets,
                        color: color,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            monthName,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                          Text(
                            date.year.toString(),
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.white54 : Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      displayVal,
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                        color: isDark ? Colors.white : Colors.black,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildHeader(user, double balance, AppPreferences prefs) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final locale = prefs.locale.languageCode;
    final currencyFormat = NumberFormat.currency(
      symbol: 'Rs. ',
      decimalDigits: 2,
    );
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 28, 16, 0),
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        gradient: AppTheme.getHeaderGradient(context),
        borderRadius: BorderRadius.circular(40),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.3),
                  blurRadius: 30,
                  offset: const Offset(0, 15),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => _onTabTapped(3),
                  behavior: HitTestBehavior.opaque,
                  child: Row(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.white30, width: 2),
                          shape: BoxShape.circle,
                        ),
                        child: CircleAvatar(
                          backgroundColor: Colors.white24,
                          child: Icon(
                            LucideIcons.user,
                            color: Colors.white.withValues(alpha: 0.9),
                            size: 24,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              user?['name'] ?? 'Heshan Nipuna',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 20,
                                color: Colors.white,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              user?['farmerCode'] ?? 'FRM-004',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white.withValues(alpha: 0.7),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _headerAction(
                context,
                prefs.themeMode == ThemeMode.light
                    ? LucideIcons.moon
                    : LucideIcons.sun,
                onTap: () {
                  HapticFeedback.mediumImpact();
                  prefs.toggleTheme();
                },
              ),
              const SizedBox(width: 12),
              _headerAction(
                context,
                LucideIcons.bell,
                onTap: _showNotifications,
                showBadge: _notifications.any((n) => n['isRead'] == false),
              ),
            ],
          ),
          const SizedBox(height: 48),
          Row(
            children: [
              Text(
                Translations.get('total_balance', locale),
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.7),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () =>
                    setState(() => _isBalanceVisible = !_isBalanceVisible),
                child: Icon(
                  _isBalanceVisible ? LucideIcons.eye : LucideIcons.eyeOff,
                  size: 16,
                  color: Colors.white.withValues(alpha: 0.4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: Text(
              _isBalanceVisible ? currencyFormat.format(balance) : '••••••',
              key: ValueKey(_isBalanceVisible),
              style: const TextStyle(
                fontSize: 44,
                fontWeight: FontWeight.w900,
                color: Colors.white,
                letterSpacing: -1,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _headerAction(
    BuildContext context,
    IconData icon, {
    required VoidCallback onTap,
    bool showBadge = false,
  }) {
    return BouncingButton(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, size: 20, color: Colors.black),
          ),
          if (showBadge)
            Positioned(
              right: -2,
              top: -2,
              child: Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: Theme.of(context).brightness == Brightness.light
                      ? const Color(0xFF1B264F)
                      : const Color(
                          0xFFFFB000,
                        ), // Back to Premium Gold for Dark
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _fintechCollectionCard(dynamic c, String locale) {
    return TweenAnimationBuilder(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOutQuint,
      tween: Tween<double>(begin: 0, end: 1),
      builder: (context, double value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color,
          borderRadius: BorderRadius.circular(32),
          boxShadow: AppTheme.premiumShadow,
          border: Border.all(
            color: Theme.of(context).brightness == Brightness.dark
                ? Colors.white10
                : Colors.grey.shade50,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color:
                    (Theme.of(context).brightness == Brightness.dark
                            ? AppTheme.primaryLight
                            : AppTheme.primary)
                        .withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(
                LucideIcons.droplets,
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.primaryLight
                    : AppTheme.primary,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${Translations.get('collection_id', locale)} #${c['id'] ?? '...'}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${Translations.formatDate(DateTime.parse(c['date']), locale)} • ${Translations.get(c['milkType']?.toString().toLowerCase() ?? 'cow', locale)}',
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '+${c['quantity']} L',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppTheme.primaryLight
                        : AppTheme.primary,
                    fontSize: 18,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                _statusBadge(c['qualityResult'] ?? 'Pending', locale),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPassbookView(String locale) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: const SizedBox.shrink(),
    );
  }

  Widget _buildPaymentsView(String locale) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: const SizedBox.shrink(),
    );
  }

  Widget _buildSwapSummaryCard(double total, String locale) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.primary,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                Translations.get('total_earnings', locale),
                style: const TextStyle(
                  color: Colors.white70,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'LKR',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Rs. ${total.toStringAsFixed(2)}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.w900,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 24),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Text(
              Translations.get('withdraw_funds', locale),
              style: const TextStyle(
                color: AppTheme.primary,
                fontWeight: FontWeight.w900,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _staggered(int index, Widget child) {
    return TweenAnimationBuilder(
      duration: Duration(milliseconds: 300 + (index * 50).clamp(0, 300)),
      curve: Curves.easeOutQuint,
      tween: Tween<double>(begin: 0, end: 1),
      builder: (context, double value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 30 * (1 - value)),
            child: child,
          ),
        );
      },
      child: child,
    );
  }

  Widget _buildSimpleHeader(String title) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
      child: Row(
        children: [
          GestureDetector(
            onTap: _handleBack,
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: (isDark ? Colors.white10 : Colors.grey.shade100),
                shape: BoxShape.circle,
              ),
              child: Icon(
                LucideIcons.chevronLeft,
                size: 20,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: -1,
              ),
            ),
          ),
          const SizedBox(width: 44), // To balance the back button space
        ],
      ),
    );
  }

  Widget _fintechPaymentCard(dynamic p, String locale) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: AppTheme.premiumShadow,
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.grey.shade50,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              LucideIcons.banknote,
              color: Colors.green,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Rs. ${p['amount']}',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                    letterSpacing: -0.5,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${Translations.get('collection_id', locale)} #${p['collectionId']} • ${Translations.formatDate(DateTime.parse(p['paidAt'] ?? p['createdAt']), locale)}',
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                ),
              ],
            ),
          ),
          _statusBadge(p['status'] ?? 'Pending', locale),
        ],
      ),
    );
  }

  Widget _statusBadge(String status, String locale) {
    Color color;
    switch (status.toLowerCase()) {
      case 'pass':
      case 'paid':
      case 'approved':
        color = Colors.green;
        break;
      case 'fail':
      case 'rejected':
        color = Colors.red;
        break;
      default:
        color = Colors.orange;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        Translations.get(status.toLowerCase(), locale),
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
