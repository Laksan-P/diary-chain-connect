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
import '../services/weather_service.dart';
import '../widgets/bouncing_button.dart';
import '../widgets/premium_bottom_nav.dart';
import '../widgets/notification_banner.dart';
import '../widgets/farmer/farmer_hero_header.dart';
import '../widgets/farmer/farmer_scenic_background.dart';
import '../services/hero_background_service.dart';
import '../widgets/farmer/todays_milk_hero_card.dart';
import '../widgets/farmer/activity_shortcut_row.dart';
import '../widgets/farmer/shimmer_loading.dart';
import '../widgets/fade_slide_in.dart';
import '../theme/design_tokens.dart';
import '../utils/farmer_performance_helper.dart';
import '../utils/farmer_recommendation_helper.dart';
import '../utils/chilling_center_resolver.dart';
import '../utils/collection_status_helper.dart';

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

  // Badge tracking: stores the count the user last saw
  int _lastSeenCollectionCount = 0;
  int _lastSeenPaymentCount = 0;
  bool _hasNewCollections = false;
  bool _hasNewPayments = false;
  bool _hasUnreadSupport = false;
  InAppNotificationData? _bannerNotification;
  final Set<String> _knownNotificationIds = {};
  bool _isResolvingCenter = true;
  WeatherSnapshot? _weather;

  @override
  void initState() {
    super.initState();
    _loadSeenCounts();
    _loadCachedData().then((_) {
      _fetchData();
      _resolveFarmerCenter();
    });
    _startAutoRefresh();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _fetchWeather();
    });
  }

  Future<void> _loadCachedData() async {
    try {
      final offline = OfflineService();
      final cols = offline.getCachedData('collections');
      final pays = offline.getCachedData('payments');
      final notifs = offline.getCachedData('notifications');
      final perf = offline.getCachedData('performance');
      final farmerId = _auth?.user?['farmerId']?.toString();

      if (mounted) {
        setState(() {
          if (cols != null) {
            _collections = ChillingCenterResolver.collectionsForFarmer(
              List<dynamic>.from(cols),
              farmerId,
            );
          }
          if (pays != null) _payments = List<dynamic>.from(pays);
          if (notifs != null) _notifications = List<dynamic>.from(notifs);
          if (perf is Map) {
            _performance = Map<String, dynamic>.from(perf);
          }

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

  void _mergeFarmerPerformanceRecord(Map<String, dynamic> record) {
    final rec = record['performance_recommendation'];
    final status = record['performance_status']?.toString();
    final hasRec = rec != null && rec.toString().trim().isNotEmpty;
    final hasStatus = status != null && status.isNotEmpty;
    if (!hasRec && !hasStatus) return;

    final merged = Map<String, dynamic>.from(_performance);
    if (hasStatus) merged['status'] = status;
    if (hasRec &&
        (merged['recommendation'] == null ||
            merged['recommendation'].toString().trim().isEmpty)) {
      merged['recommendation'] = rec;
    }
    _performance = merged;
  }

  Map<String, dynamic> _parsePerformanceResponse(dynamic raw) {
    if (raw is! Map) return {};
    return Map<String, dynamic>.from(raw);
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
        _fetchWeather();
      }
    });
  }

  // â”€â”€ Badge Management â”€â”€
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
        _api.get('/operations?action=performance&type=farmer'),
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
        _hasUnreadSupport = supportTickets.any(
          (t) => t['is_read_by_user'] == false,
        );

        _performance = _parsePerformanceResponse(results[4]);

        _updateBadges();
        _maybeShowInAppBanner(notifs);
      });

      // Save to Hive cache for instant loading next time
      final offline = OfflineService();
      await offline.saveCachedData('collections', _collections);
      await offline.saveCachedData('payments', _payments);
      await offline.saveCachedData('notifications', _notifications);
      await offline.saveCachedData('performance', _performance);
      await _resolveFarmerCenter();
      await _fetchWeather();
    } catch (e) {
      debugPrint("Fetch data failed: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resolveFarmerCenter() async {
    if (!mounted || _auth?.user == null) return;
    if (mounted) setState(() => _isResolvingCenter = true);

    try {
      final user = _auth!.user!;
      final farmerId = user['farmerId'];

      if (farmerId != null && OfflineService().isOnline) {
        try {
          final farmerData = await _api.get('/farmers?action=get&id=$farmerId');
          if (farmerData != null && mounted) {
            final record = Map<String, dynamic>.from(farmerData as Map);
            _mergeFarmerPerformanceRecord(record);
            final ccId = record['chillingCenterId'];
            final updates = <String, dynamic>{};
            if (ccId != null) updates['chillingCenterId'] = ccId;

            final resolved = ChillingCenterResolver.fromFarmerRecord(record);
            if (resolved != null && resolved.isNotEmpty) {
              updates['chillingCenterName'] = resolved;
            } else if (ccId != null) {
              final lookedUp =
                  ChillingCenterResolver.nameForCenterId(ccId.toString());
              if (lookedUp != null) updates['chillingCenterName'] = lookedUp;
            }

            if (updates.isNotEmpty) {
              _auth!.updateLocalUser(updates);
              if (mounted) {
                setState(() {});
                await OfflineService()
                    .saveCachedData('performance', _performance);
              }
              return;
            }

            if (mounted) {
              setState(() {});
              await OfflineService()
                  .saveCachedData('performance', _performance);
            }
            return;
          }
        } catch (e) {
          debugPrint('Fetch farmer center failed: $e');
        }
      }

      final name = ChillingCenterResolver.resolve(
        user: user,
        collections: _collections,
      );
      if (name != null && name.isNotEmpty) {
        _auth!.updateLocalUser({'chillingCenterName': name});
        if (mounted) setState(() {});
        return;
      }

      if (OfflineService().getCachedData('chilling_centers') == null &&
          OfflineService().isOnline) {
        try {
          final centers = await _api.get('/chilling-centers?action=list');
          await OfflineService().saveCachedData('chilling_centers', centers);
          final lookedUp = ChillingCenterResolver.fromOfflineCache(user);
          if (lookedUp != null && lookedUp.isNotEmpty) {
            _auth!.updateLocalUser({'chillingCenterName': lookedUp});
            if (mounted) setState(() {});
          }
        } catch (_) {}
      }
    } catch (e) {
      debugPrint('Resolve farmer center failed: $e');
    } finally {
      if (mounted) setState(() => _isResolvingCenter = false);
    }
  }

  Future<void> _fetchWeather() async {
    if (!OfflineService().isOnline) return;
    try {
      final snapshot = await WeatherService().fetch(user: _auth?.user);
      if (!mounted || snapshot == null || !snapshot.isValid) return;
      setState(() => _weather = snapshot);
    } catch (_) {}
  }

  String _assignedCenterLabel(Map<String, dynamic>? user, String locale) {
    final farmerId = user?['farmerId']?.toString();
    final name = ChillingCenterResolver.resolve(
      user: user,
      collections: ChillingCenterResolver.collectionsForFarmer(
        _collections,
        farmerId,
      ),
    );
    if (name != null && name.isNotEmpty) return name;

    final hasCenterId = user?['chillingCenterId'] != null &&
        user!['chillingCenterId'].toString().isNotEmpty;

    if (_isResolvingCenter && hasCenterId) {
      return Translations.get('loading_center', locale);
    }

    if (hasCenterId) {
      return Translations.get('loading_center', locale);
    }

    return Translations.get('center_not_assigned', locale);
  }

  ({
    double? passRate,
    int inspectedCount,
    String status,
  }) _performanceMetrics() {
    final metrics = FarmerPerformanceHelper.resolveMetrics(
      collections: _collections,
      performance: _performance,
    );
    return (
      passRate: metrics.passRate,
      inspectedCount: metrics.inspectedCount,
      status: FarmerPerformanceHelper.resolvePerformanceStatus(
        collections: _collections,
        performance: _performance,
      ),
    );
  }

  FarmerRecommendationVisibility _recommendationVisibility() {
    return FarmerPerformanceHelper.resolveRecommendationVisibility(
      collections: _collections,
      performance: _performance,
    );
  }

  FarmerRecommendationContent _recommendationContent(String locale) {
    final content = FarmerRecommendationHelper.resolveImprovement(
      performance: _performance,
      locale: locale,
    );
    return FarmerRecommendationHelper.filterIssuesByActualFailures(
      content,
      _collections,
    );
  }

  String _issueTagLabel(String tag, String locale) {
    switch (tag.trim().toUpperCase()) {
      case 'SNF':
        return Translations.labelForKey('low_snf', locale);
      case 'FAT':
        return Translations.labelForKey('low_fat', locale);
      case 'WATER':
        return Translations.labelForKey('excess_water', locale);
      case 'MULTIPLE':
        return Translations.labelForKey('multiple_quality_issues', locale);
      default:
        return Translations.translateReason(tag, locale);
    }
  }

  Color _passRateAccentColor(bool isDark, double? passRate) {
    if (passRate == null) {
      return isDark ? Colors.white : Colors.black54;
    }
    if (FarmerPerformanceHelper.isPassingPassRate(passRate)) {
      return isDark ? const Color(0xFF6EE7B7) : AppColors.primaryGreen;
    }
    return isDark ? const Color(0xFFFFB347) : AppColors.warning;
  }

  String _passRateLabel(String locale) {
    final metrics = _performanceMetrics();
    if (metrics.inspectedCount == 0 || metrics.passRate == null) {
      return Translations.get('not_enough_data', locale);
    }
    return '${metrics.passRate!.toStringAsFixed(1)}%';
  }

  String _performanceStatusLabel(String locale, {required String status}) {
    switch (status) {
      case 'Good':
        return Translations.get('perf_good', locale);
      case 'Needs Improvement':
        return Translations.get('perf_needs_improvement', locale);
      case 'Not Enough Data':
        return Translations.get('not_enough_data', locale);
      default:
        return status;
    }
  }

  /// Generates local notifications for data that exists but has no alert yet
  void _synthesizeNotifications() {
    bool changed = false;
    final locale = Localizations.localeOf(context).languageCode;

    // 1. Check for New Collections
    for (var col in _collections) {
      final date = col['date']?.toString() ?? '';
      final isFail = CollectionStatusHelper.isQualityFail(col);
      final isRejected =
          CollectionStatusHelper.normalizeDispatchStatus(col) == 'rejected';

      // Look for a CC/chilling-center quality notification for this date (not NestlÃ© verification)
      final exists = _notifications.any((n) {
        if (n['type'] != 'quality_result' && n['type'] != 'general') return false;
        final msg = n['message']?.toString() ?? '';
        final title = n['title']?.toString() ?? '';
        if (!msg.contains(date)) return false;
        if (title.contains('nestle_quality') || msg.contains('nestle_quality')) {
          return false;
        }
        if (title.contains('nestle_quality_test') || msg.contains('nestle_quality_test')) {
          return false;
        }
        return true;
      });

      if (!exists) {
        String title = 'Milk Collection Recorded';
        String message =
            'Your milk collection on $date has been recorded in the system.';

        if (isFail || isRejected) {
          title = 'quality_test_failed_title';
          String displayReason = CollectionStatusHelper.translatedFailureReason(
            col,
            locale,
          );

          message = 'quality_test_failed_msg|date:$date,reason:$displayReason';
        } else if (CollectionStatusHelper.isQualityPass(col)) {
          title = 'quality_test_passed_title';
          message = 'quality_test_passed_msg|date:$date';
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

  void _maybeShowInAppBanner(List<dynamic> notifs) {
    if (!mounted || _currentIndex == 4) return;
    final locale = context.read<AppPreferences>().locale.languageCode;

    for (final note in notifs) {
      final id = note['id']?.toString() ?? '';
      if (id.isEmpty || _knownNotificationIds.contains(id)) continue;
      if (note['isRead'] == true) {
        _knownNotificationIds.add(id);
        continue;
      }

      _knownNotificationIds.add(id);
      final title = _bannerTitleFor(note, locale);
      final message = _bannerMessageFor(note, locale);
      setState(() {
        _bannerNotification = InAppNotificationData(
          title: title,
          message: message,
          icon: _bannerIconFor(note['type']?.toString() ?? ''),
          accentColor: _bannerColorFor(note['type']?.toString() ?? ''),
        );
      });
      break;
    }

    _knownNotificationIds.addAll(
      notifs.map((n) => n['id']?.toString() ?? '').where((id) => id.isNotEmpty),
    );
  }

  String _bannerTitleFor(dynamic note, String locale) {
    final raw = note['title']?.toString() ?? '';
    if (raw.contains('_title') || raw.contains('_msg')) {
      return Translations.get(raw.split('|').first, locale);
    }
    return raw.isNotEmpty ? raw : Translations.get('notifications', locale);
  }

  String _bannerMessageFor(dynamic note, String locale) {
    final raw = note['message']?.toString() ?? '';
    if (raw.contains('|')) {
      final parts = raw.split('|');
      final key = parts.first;
      final params = <String, String>{};
      if (parts.length > 1) {
        for (final p in parts[1].split(',')) {
          final kv = p.split(':');
          if (kv.length == 2) params[kv[0].trim()] = kv[1].trim();
        }
      }
      return Translations.get(key, locale, params: params);
    }
    return raw;
  }

  IconData _bannerIconFor(String type) {
    switch (type) {
      case 'payment':
      case 'payment_reminder':
        return LucideIcons.wallet;
      case 'quality_result':
        return LucideIcons.droplets;
      case 'dispatch':
      case 'dispatch_status':
        return LucideIcons.truck;
      default:
        return LucideIcons.bell;
    }
  }

  Color _bannerColorFor(String type) {
    switch (type) {
      case 'payment':
        return AppColors.success;
      case 'quality_result':
        return AppColors.nestleBlue;
      case 'dispatch':
      case 'dispatch_status':
        return AppColors.warning;
      default:
        return AppColors.nestleBlue;
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
      extendBody: true,
      body: Stack(
        children: [
          IndexedStack(
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
            weatherCondition: _weather?.condition,
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
                  builder: (context) =>
                      SupportChatScreen(onBack: () => Navigator.pop(context)),
                ),
              );
            },
          ),
        ],
          ),
          if (_bannerNotification != null)
            NotificationBanner(
              data: _bannerNotification!,
              onTap: _showNotifications,
              onDismiss: () => setState(() => _bannerNotification = null),
            ),
        ],
      ),
      bottomNavigationBar: PremiumBottomNav(
        currentIndex: _currentIndex == 4 ? -1 : _currentIndex,
        onTap: _onTabTapped,
        homeLabel: Translations.get('home', locale),
        passbookLabel: Translations.get('passbook', locale),
        paymentsLabel: Translations.get('payments', locale),
        profileLabel: Translations.get('profile', locale),
        showHomeBadge: _notifications.any((n) => n['isRead'] == false),
        showPassbookBadge: _hasNewCollections,
        showPaymentsBadge: _hasNewPayments,
        showProfileBadge: _hasUnreadSupport,
      ),
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
            builder: (context) =>
                FaqScreen(onBack: () => Navigator.pop(context)),
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
                ? [
                    AppTheme.primaryLight,
                    AppTheme.primaryLight.withOpacity(0.8),
                  ]
                : [AppTheme.primary, AppTheme.primary.withOpacity(0.85)],
          ),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: (isDark ? AppTheme.primaryLight : AppTheme.primary)
                  .withOpacity(0.4),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
          border: Border.all(color: Colors.white.withOpacity(0.2), width: 1.5),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final now = DateTime.now();
    final currentMonthPayments = _payments.where((p) {
      try {
        final date = DateTime.parse(p['createdAt']);
        return date.month == now.month && date.year == now.year;
      } catch (_) {
        return false;
      }
    });

    final monthlyEarnings = currentMonthPayments
        .where((p) => (p['status'] ?? '').toString().toLowerCase() == 'paid')
        .fold(0.0, (sum, p) {
      return sum + (double.tryParse(p['amount'].toString()) ?? 0.0);
    });

    final milkData = _computeTodaysMilkData();
    final centerName = _assignedCenterLabel(user, locale);

    final monthlyLiters = _collections
        .where((c) {
          try {
            final raw = c['createdAt'] ?? c['date'];
            if (raw == null) return false;
            final date = DateTime.parse(raw.toString());
            return date.month == now.month && date.year == now.year;
          } catch (_) {
            return false;
          }
        })
        .fold(0.0, (sum, c) {
          return sum + (double.tryParse(c['quantity'].toString()) ?? 0.0);
        });

    final contentBg = Theme.of(context).scaffoldBackgroundColor;
    final topInset = MediaQuery.paddingOf(context).top;
    final heroHeight = HeroBackgroundService.homeHeroHeight + topInset;
    const heroToMilkGap = 16.0;
    const contentGapAfterMilk = 32.0;
    final bottomScrollPadding =
        MediaQuery.paddingOf(context).bottom + 180;
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final minContentHeight = (viewportHeight - heroHeight - 220 - contentGapAfterMilk)
        .clamp(240.0, double.infinity);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: OfflineBanner(locale: locale),
          ),
          SizedBox(
            height: heroHeight,
            width: double.infinity,
            child: FarmerScenicBackground(
              height: heroHeight,
              weatherCondition: _weather?.condition,
              headerReadable: true,
              showBottomFade: true,
              fadeToColor: contentBg,
              child: FarmerHeroContent(
                layout: FarmerHeroLayout.embedded,
                bottomContentInset: 28,
                locale: locale,
                farmerName: user['name']?.toString() ?? '',
                farmerCode: user['farmerCode']?.toString() ?? '',
                farmOrCenterName: centerName,
                weatherCelsius: _weather?.celsius,
                weatherCondition: _weather?.condition,
                hasUnreadNotifications:
                    _notifications.any((n) => n['isRead'] == false),
                isDarkMode: isDark,
                onProfileTap: () => _onTabTapped(3),
                onNotificationsTap: _showNotifications,
                onThemeToggle: () {
                  HapticFeedback.mediumImpact();
                  prefs.toggleTheme();
                },
              ),
            ),
          ),
          SizedBox(height: heroToMilkGap),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: FadeSlideIn(
              index: 0,
              child: TodaysMilkHeroCard(
                locale: locale,
                overlapHero: false,
                totalLiters: milkData.totalLiters,
                avgFat: milkData.avgFat,
                qualityDisplayKey: milkData.qualityDisplayKey,
                collectionDisplayKey: milkData.collectionDisplayKey,
                failureReason: milkData.failureReason,
                onTap: () => _onTabTapped(1),
              ),
            ),
          ),
          SizedBox(height: contentGapAfterMilk),
          Container(
            width: double.infinity,
            constraints: BoxConstraints(minHeight: minContentHeight),
            color: contentBg,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_isLoading && _collections.isEmpty && _payments.isEmpty)
                  const HomeDashboardSkeleton()
                else ...[
                  FadeSlideIn(
                    index: 1,
                    child: _homeSectionTitle(locale, 'quick_status'),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideIn(
                    index: 2,
                    child: _buildActivityShortcuts(
                      locale,
                      user,
                      milkData,
                      centerName,
                    ),
                  ),
                  const SizedBox(height: 24),
                  FadeSlideIn(
                    index: 3,
                    child: _buildMonthlySummary(
                      monthlyEarnings,
                      monthlyLiters,
                      locale,
                    ),
                  ),
                  const SizedBox(height: 24),
                  FadeSlideIn(
                    index: 4,
                    child: _buildRecommendationSection(locale),
                  ),
                ],
                SizedBox(height: bottomScrollPadding),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _homeSectionTitle(String locale, String translationKey) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      Translations.get(translationKey, locale),
      style: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.2,
        color: isDark ? Colors.white : AppColors.deepForest,
      ),
    );
  }

  ({
    double totalLiters,
    double? avgFat,
    String? qualityDisplayKey,
    String? collectionDisplayKey,
    String? failureReason,
  }) _computeTodaysMilkData() {
    final locale = context.read<AppPreferences>().locale.languageCode;
    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    final latest = CollectionStatusHelper.latestForDate(_collections, todayStr);
    final todays = _collections.where((c) {
      final d = c['date']?.toString() ?? '';
      return d.startsWith(todayStr);
    }).toList();

    final totalLiters = todays.fold<double>(
      0,
      (sum, c) => sum + (double.tryParse(c['quantity']?.toString() ?? '0') ?? 0),
    );

    double? avgFat;
    final fatValues = todays
        .map((c) => double.tryParse(
              c['fat']?.toString() ?? c['fatPercentage']?.toString() ?? '',
            ))
        .whereType<double>()
        .toList();
    if (fatValues.isNotEmpty) {
      avgFat = fatValues.reduce((a, b) => a + b) / fatValues.length;
    }

    if (latest == null) {
      return (
        totalLiters: totalLiters,
        avgFat: avgFat,
        qualityDisplayKey: null,
        collectionDisplayKey: null,
        failureReason: null,
      );
    }

    final qualityDisplayKey = CollectionStatusHelper.qualityDisplayKey(latest);
    final collectionDisplayKey =
        CollectionStatusHelper.collectionDisplayKey(latest);
    final failureReason = CollectionStatusHelper.isQualityFail(latest)
        ? CollectionStatusHelper.translatedFailureReason(latest, locale)
        : null;

    return (
      totalLiters: totalLiters,
      avgFat: avgFat,
      qualityDisplayKey: qualityDisplayKey,
      collectionDisplayKey: collectionDisplayKey,
      failureReason: failureReason,
    );
  }

  Widget _buildActivityShortcuts(
    String locale,
    dynamic user,
    ({
      double totalLiters,
      double? avgFat,
      String? qualityDisplayKey,
      String? collectionDisplayKey,
      String? failureReason,
    }) milkData,
    String centerName,
  ) {
    final latestPayment = _payments.isNotEmpty ? _payments.first : null;
    final paymentStatus = latestPayment?['status']?.toString() ?? '';

    String collectionValue;
    if (milkData.totalLiters > 0) {
      collectionValue =
          '${milkData.totalLiters.toStringAsFixed(1)} ${Translations.get('liters_short', locale)}';
    } else {
      collectionValue = Translations.get('no_collection_today', locale);
    }

    String qualityValue = CollectionStatusHelper.translatedStatusLabel(
      milkData.qualityDisplayKey,
      locale,
    );

    String paymentValue;
    if (latestPayment == null) {
      paymentValue = Translations.get('no_payments_yet', locale);
    } else if (paymentStatus.toLowerCase() == 'paid') {
      paymentValue = Translations.get('payment_received_status', locale);
    } else {
      paymentValue = Translations.get('payment_pending_status', locale);
    }

    return ActivityShortcutRow(
      items: [
        ActivityShortcutItem(
          label: Translations.get('collection_status', locale),
          value: collectionValue,
          icon: LucideIcons.droplets,
          color: AppColors.nestleBlue,
          onTap: () => _onTabTapped(1),
        ),
        ActivityShortcutItem(
          label: Translations.get('quality_status', locale),
          value: qualityValue,
          icon: LucideIcons.badgeCheck,
          color: AppColors.primaryGreen,
          onTap: () => _onTabTapped(1),
        ),
        ActivityShortcutItem(
          label: Translations.get('payment_status', locale),
          value: paymentValue,
          icon: LucideIcons.wallet,
          color: AppColors.warning,
          onTap: () => _onTabTapped(2),
        ),
        ActivityShortcutItem(
          label: Translations.get('assigned_center', locale),
          value: centerName,
          icon: LucideIcons.mapPin,
          color: AppColors.deepForest,
          onTap: () => _onTabTapped(3),
        ),
      ],
    );
  }

  Widget _buildMonthlySummary(
    double monthlyEarnings,
    double monthlyLiters,
    String locale,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFormat = NumberFormat.currency(symbol: 'Rs. ', decimalDigits: 0);
    final metrics = _performanceMetrics();
    final passRateColor = _passRateAccentColor(isDark, metrics.passRate);
    final labelColor = isDark
        ? Colors.white.withValues(alpha: 0.72)
        : AppColors.deepForest.withValues(alpha: 0.65);
    final statusColor = isDark
        ? (metrics.passRate == null
            ? Colors.white.withValues(alpha: 0.72)
            : passRateColor)
        : AppColors.deepForest.withValues(alpha: 0.55);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _homeSectionTitle(locale, 'this_month'),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _monthlyStatTile(
                Translations.get('monthly_liters', locale),
                '${monthlyLiters.toStringAsFixed(0)} L',
                LucideIcons.droplets,
                AppColors.nestleBlue,
                onTap: () => _showMonthlyBreakdown('liters', locale),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _monthlyStatTile(
                Translations.get('monthly_earnings', locale),
                currencyFormat.format(monthlyEarnings),
                LucideIcons.wallet,
                AppColors.primaryGreen,
                onTap: () => _showMonthlyBreakdown('earnings', locale),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: () => _onTabTapped(1),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(AppRadii.lg),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.black.withValues(alpha: 0.04),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: passRateColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(LucideIcons.badgeCheck, size: 18, color: passRateColor),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        Translations.get('quality_pass_rate', locale),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: labelColor,
                        ),
                      ),
                      Text(
                        _passRateLabel(locale),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: isDark ? Colors.white : AppColors.deepForest,
                        ),
                      ),
                      Text(
                        _performanceStatusLabel(
                          locale,
                          status: metrics.status,
                        ),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  LucideIcons.chevronRight,
                  size: 18,
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.55)
                      : AppColors.deepForest.withValues(alpha: 0.35),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRecommendationSection(String locale) {
    if (_recommendationVisibility() == FarmerRecommendationVisibility.hidden) {
      return const SizedBox.shrink();
    }

    final content = _recommendationContent(locale);
    if (content.hasContent) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _homeSectionTitle(locale, 'recommendations'),
          const SizedBox(height: 12),
          _buildPerformanceCard(locale, content),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _homeSectionTitle(locale, 'recommendations'),
        const SizedBox(height: 12),
        _buildFallbackRecommendationCard(locale),
      ],
    );
  }

  Widget _buildFallbackRecommendationCard(String locale) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.black.withValues(alpha: 0.04),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(LucideIcons.info, size: 18, color: AppColors.warning),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              Translations.labelForKey('contact_chilling_center', locale),
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: isDark
                    ? Colors.white.withValues(alpha: 0.88)
                    : Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _monthlyStatTile(
    String label,
    String value,
    IconData icon,
    Color color, {
    VoidCallback? onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.04),
        ),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: color.withValues(alpha: 0.08),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 10),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: isDark ? Colors.white : AppColors.deepForest,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isDark
                  ? Colors.white.withValues(alpha: 0.72)
                  : AppColors.deepForest.withValues(alpha: 0.65),
            ),
          ),
        ],
      ),
    ),
    );
  }

  Widget _buildPerformanceCard(
    String locale,
    FarmerRecommendationContent content,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final issueTags = content.issueTags;

    return Container(
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
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            iconColor: isDark ? const Color(0xFFFED7AA) : const Color(0xFF9A3412),
            collapsedIconColor: isDark ? const Color(0xFFFED7AA) : const Color(0xFF9A3412),
            tilePadding: const EdgeInsets.all(20),
            childrenPadding: const EdgeInsets.only(left: 20, right: 20, bottom: 20),
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF97316).withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    LucideIcons.alertTriangle,
                    color: Color(0xFFF97316),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (content.title.isNotEmpty)
                        Text(
                          content.title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: isDark
                                ? const Color(0xFFFFEDD5)
                                : const Color(0xFF7C2D12),
                          ),
                        ),
                      if (content.severity != null &&
                          content.severity!.isNotEmpty) ...[
                        if (content.title.isNotEmpty) const SizedBox(height: 4),
                        Text(
                          content.severity!,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: isDark
                                ? const Color(0xFFF97316)
                                : const Color(0xFFEA580C),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (issueTags.isNotEmpty) ...[
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: issueTags
                          .map(
                            (tag) => Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? const Color(0xFF78350F).withValues(alpha: 0.45)
                                    : const Color(0xFFFED7AA).withValues(alpha: 0.65),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                _issueTagLabel(tag, locale),
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: isDark
                                      ? const Color(0xFFFED7AA)
                                      : const Color(0xFF9A3412),
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (content.message.isNotEmpty)
                    Text(
                      content.message,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.5,
                        fontWeight: FontWeight.w500,
                        color: isDark
                            ? const Color(0xFFFED7AA)
                            : const Color(0xFF9A3412),
                      ),
                    ),
                ],
              ),
            ),
            children: [
              if (content.guidance.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.black26 : Colors.white54,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        Translations.get('recommended_actions', locale),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isDark ? const Color(0xFFFFEDD5) : const Color(0xFF7C2D12),
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ...content.guidance.map((tip) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                LucideIcons.checkCircle2,
                                size: 14,
                                color: isDark ? const Color(0xFFF97316) : const Color(0xFFEA580C),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  tip,
                                  style: TextStyle(
                                    fontSize: 12,
                                    height: 1.4,
                                    color: isDark ? const Color(0xFFFED7AA) : const Color(0xFF9A3412),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ),
                ),
            ],
          ),
        ),
    );
  }

  void _showMonthlyBreakdown(String type, String locale) {
    final history = type == 'earnings'
        ? _buildMonthlyEarningsHistory()
        : _buildMonthlyLitersHistory();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _MonthlyBreakdownSheet(
        type: type,
        history: history,
        locale: locale,
      ),
    );
  }

  List<Map<String, dynamic>> _buildMonthlyLitersHistory() {
    final grouped = <String, double>{};
    final monthDates = <String, DateTime>{};

    for (final collection in _collections) {
      try {
        final raw = collection['createdAt'] ?? collection['date'];
        if (raw == null) continue;
        final parsed = DateTime.parse(raw.toString());
        final key = '${parsed.year}-${parsed.month}';
        final liters = double.tryParse(collection['quantity'].toString()) ?? 0.0;
        grouped[key] = (grouped[key] ?? 0) + liters;
        monthDates[key] = DateTime(parsed.year, parsed.month);
      } catch (_) {}
    }

    return _sortedMonthlyHistory(grouped, monthDates);
  }

  List<Map<String, dynamic>> _buildMonthlyEarningsHistory() {
    final grouped = <String, double>{};
    final monthDates = <String, DateTime>{};

    for (final payment in _payments) {
      if ((payment['status'] ?? '').toString().toLowerCase() != 'paid') {
        continue;
      }
      try {
        final raw = payment['paidAt'] ?? payment['createdAt'];
        if (raw == null) continue;
        final parsed = DateTime.parse(raw.toString());
        final key = '${parsed.year}-${parsed.month}';
        final amount = double.tryParse(payment['amount'].toString()) ?? 0.0;
        grouped[key] = (grouped[key] ?? 0) + amount;
        monthDates[key] = DateTime(parsed.year, parsed.month);
      } catch (_) {}
    }

    return _sortedMonthlyHistory(grouped, monthDates);
  }

  List<Map<String, dynamic>> _sortedMonthlyHistory(
    Map<String, double> grouped,
    Map<String, DateTime> monthDates,
  ) {
    final history = grouped.entries.map((entry) {
      return {
        'date': monthDates[entry.key]!,
        'val': entry.value,
      };
    }).toList();

    history.sort(
      (a, b) => (b['date'] as DateTime).compareTo(a['date'] as DateTime),
    );
    return history;
  }
}

enum _MonthlyHistoryFilter { latest, last3, last6, all }

class _MonthlyBreakdownSheet extends StatefulWidget {
  final String type;
  final List<Map<String, dynamic>> history;
  final String locale;

  const _MonthlyBreakdownSheet({
    required this.type,
    required this.history,
    required this.locale,
  });

  @override
  State<_MonthlyBreakdownSheet> createState() => _MonthlyBreakdownSheetState();
}

class _MonthlyBreakdownSheetState extends State<_MonthlyBreakdownSheet> {
  /// Default: show the newest 3 months that have real data.
  _MonthlyHistoryFilter _filter = _MonthlyHistoryFilter.last3;

  String _filterLabel(_MonthlyHistoryFilter filter) {
    switch (filter) {
      case _MonthlyHistoryFilter.latest:
        return Translations.get('latest_month', widget.locale);
      case _MonthlyHistoryFilter.last3:
        return Translations.get('last_3_months', widget.locale);
      case _MonthlyHistoryFilter.last6:
        return Translations.get('last_6_months', widget.locale);
      case _MonthlyHistoryFilter.all:
        return Translations.get('all_months', widget.locale);
    }
  }

  int _monthLimitForFilter(_MonthlyHistoryFilter filter) {
    switch (filter) {
      case _MonthlyHistoryFilter.latest:
        return 1;
      case _MonthlyHistoryFilter.last3:
        return 3;
      case _MonthlyHistoryFilter.last6:
        return 6;
      case _MonthlyHistoryFilter.all:
        return widget.history.length;
    }
  }

  /// [widget.history] is already sorted newest-first from real grouped data.
  List<Map<String, dynamic>> _filteredHistory() {
    if (widget.history.isEmpty) return const [];
    final limit = _monthLimitForFilter(_filter);
    return widget.history.take(limit).toList(growable: false);
  }

  Future<void> _showFilterMenu(Color accent, bool isDark) async {
    final currentFilter = _filter;
    final selected = await showModalBottomSheet<_MonthlyHistoryFilter>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (menuContext) {
        return SafeArea(
          child: Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1A1F2C) : Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.08)
                    : Colors.black.withValues(alpha: 0.06),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    Translations.get('filter_months', widget.locale),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                for (final option in _MonthlyHistoryFilter.values)
                  ListTile(
                    title: Text(
                      _filterLabel(option),
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontWeight: option == currentFilter
                            ? FontWeight.w800
                            : FontWeight.w500,
                      ),
                    ),
                    trailing: option == currentFilter
                        ? Icon(LucideIcons.check, color: accent, size: 18)
                        : null,
                    onTap: () => Navigator.pop(menuContext, option),
                  ),
              ],
            ),
          ),
        );
      },
    );

    if (!mounted || selected == null || selected == _filter) return;
    setState(() => _filter = selected);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isEarnings = widget.type == 'earnings';
    final accentColor = isEarnings ? Colors.green : Colors.blue;
    final chipTextColor = isDark
        ? (isEarnings ? const Color(0xFF6EE7B7) : const Color(0xFF7DD3FC))
        : accentColor;
    final chipBackground = isDark
        ? chipTextColor.withValues(alpha: 0.2)
        : chipTextColor.withValues(alpha: 0.12);
    final chipBorder = isDark
        ? chipTextColor.withValues(alpha: 0.5)
        : chipTextColor.withValues(alpha: 0.28);
    final currencyFormat = NumberFormat.currency(
      symbol: 'Rs. ',
      decimalDigits: 2,
    );
    final title = isEarnings
        ? Translations.get('monthly_earnings', widget.locale)
        : Translations.get('monthly_liters', widget.locale);
    final filtered = _filteredHistory();
    final maxHeight = MediaQuery.of(context).size.height * 0.74;

    return SafeArea(
      child: Container(
        constraints: BoxConstraints(maxHeight: maxHeight),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
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
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: isDark ? Colors.white : Colors.black,
                      letterSpacing: -1,
                    ),
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => _showFilterMenu(chipTextColor, isDark),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: chipBackground,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: chipBorder),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Flexible(
                            child: Text(
                              _filterLabel(_filter),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: chipTextColor,
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            LucideIcons.chevronDown,
                            size: 14,
                            color: chipTextColor,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    isEarnings
                        ? Translations.get(
                            'no_monthly_earnings_data',
                            widget.locale,
                          )
                        : Translations.get(
                            'no_monthly_liters_data',
                            widget.locale,
                          ),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.4,
                      color: isDark ? Colors.white.withValues(alpha: 0.85) : Colors.black54,
                    ),
                  ),
                ),
              )
            else
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final item = filtered[index];
                    final date = item['date'] as DateTime;
                    final val = item['val'] as double;
                    final monthName =
                        DateFormat('MMMM', widget.locale).format(date);
                    final displayVal = isEarnings
                        ? currencyFormat.format(val)
                        : '${val.toStringAsFixed(1)} L';

                    return Container(
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
                              color: chipTextColor.withValues(alpha: 0.14),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isEarnings
                                  ? LucideIcons.trendingUp
                                  : LucideIcons.droplets,
                              color: chipTextColor,
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
                                    color:
                                        isDark ? Colors.white : Colors.black87,
                                  ),
                                ),
                                Text(
                                  date.year.toString(),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isDark
                                        ? Colors.white.withValues(alpha: 0.78)
                                        : Colors.grey,
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
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
