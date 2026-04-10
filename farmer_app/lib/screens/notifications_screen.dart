import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/api_service.dart';
import '../services/translations.dart';
import 'app_theme.dart';

class NotificationsScreen extends StatefulWidget {
  final List<dynamic> notifications;
  final bool isLoading;
  final String userId;
  final String locale;
  final VoidCallback onBack;
  final VoidCallback onRefresh;
  final VoidCallback? onRead;

  const NotificationsScreen({
    super.key,
    required this.notifications,
    required this.isLoading,
    required this.userId,
    required this.locale,
    required this.onBack,
    required this.onRefresh,
    this.onRead,
  });

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _api = ApiService();
  // We'll use a local copy for optimistic updates, then sync with parent
  late List<dynamic> _localNotifications;

  @override
  void initState() {
    super.initState();
    _localNotifications = List.from(widget.notifications);
  }

  @override
  void didUpdateWidget(NotificationsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!mounted) return;
    // Sync local list if parent list changes (e.g. from background refresh)
    if (widget.notifications != oldWidget.notifications) {
      setState(() {
        _localNotifications = List.from(widget.notifications);
      });
    }
  }

  Future<void> _fetchNotifications({bool showLoader = true}) async {
    widget.onRefresh();
  }

  Future<void> _markAsRead(String id) async {
    // Optimistic UI update
    setState(() {
      final index = _localNotifications.indexWhere((n) => n['id'].toString() == id);
      if (index != -1) {
        _localNotifications[index]['isRead'] = true;
      }
    });

    try {
      await _api.patch('/notifications?action=mark-read&id=$id', {});
      widget.onRead?.call();
    } catch (e) {
      debugPrint("Error marking read: $e");
      _fetchNotifications(showLoader: false);
    }
  }

  /// Convert legacy hardcoded English strings to translation key format
  String _migrateLegacy(String raw) {
    // Title mappings
    if (raw == 'Quality Test Passed') return 'quality_test_passed_title';
    if (raw == 'Quality Test Failed') return 'quality_test_failed_title';
    if (raw == 'Milk Dispatched') return 'milk_dispatched_title';
    if (raw == 'Dispatch Approved') return 'dispatch_approved_title';
    if (raw == 'Dispatch Rejected') return 'dispatch_rejected_title';

    // Message: "Your milk collection on YYYY-MM-DD passed quality testing."
    final passMatch = RegExp(r'^Your milk collection on (\S+) passed quality testing\.$').firstMatch(raw);
    if (passMatch != null) {
      return 'quality_test_passed_msg|date:${passMatch.group(1)}';
    }

    // Message: "Your milk collection on YYYY-MM-DD failed quality testing. Reason: XXX"
    final failMatch = RegExp(r'^Your milk collection on (\S+) failed quality testing\. Reason: (.+)$').firstMatch(raw);
    if (failMatch != null) {
      return 'quality_test_failed_msg|date:${failMatch.group(1)},reason:${failMatch.group(2)}';
    }

    // Message: "Your milk collection on YYYY-MM-DD has been dispatched to Nestlé."
    final dispatchMatch = RegExp(r'^Your milk collection on (\S+) has been dispatched').firstMatch(raw);
    if (dispatchMatch != null) {
      return 'milk_dispatched_msg|date:${dispatchMatch.group(1)}';
    }

    // Message: "Your milk collection on YYYY-MM-DD was approved by Nestlé."
    final approveMatch = RegExp(r'^Your milk collection on (\S+) was approved').firstMatch(raw);
    if (approveMatch != null) {
      return 'dispatch_approved_msg|date:${approveMatch.group(1)}';
    }

    // Message: "Your milk collection on YYYY-MM-DD was rejected by Nestlé. Reason: XXX"
    final rejectMatch = RegExp(r'^Your milk collection on (\S+) was rejected.*Reason: (.+)$').firstMatch(raw);
    if (rejectMatch != null) {
      return 'dispatch_rejected_msg|date:${rejectMatch.group(1)},reason:${rejectMatch.group(2)}';
    }

    if (raw == 'dispatch_rejected_title') return 'dispatch_rejected_title'; // Already a key
    if (raw == 'Payment Received') return 'payment_received_title';

    // Message: "Payment of Rs. 129960.00 for 1083L of milk has been processed."
    final paymentMatch = RegExp(r'^Payment of Rs. (\S+) for (\S+)L of milk has been processed\.$').firstMatch(raw);
    if (paymentMatch != null) {
      return 'payment_received_msg|amount:${paymentMatch.group(1)},qty:${paymentMatch.group(2)}';
    }

    return raw; // No match — return original

  }

  String _translate(String? raw) {
    if (raw == null) return '';
    // First convert any legacy English strings to key format
    final migrated = _migrateLegacy(raw);
    if (migrated.contains('|')) {
      final parts = migrated.split('|');
      final key = parts[0];
      final paramsList = parts[1].split(',');
      final Map<String, String> params = {};
      for (var p in paramsList) {
        final kv = p.split(':');
        if (kv.length >= 2) params[kv[0]] = kv.sublist(1).join(':');
      }
      return Translations.get(key, widget.locale, params: params);
    }
    // If it doesn't have |, it might still be a key (like the title)
    return Translations.get(migrated, widget.locale);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: RefreshIndicator(
        onRefresh: _fetchNotifications,
        color: AppTheme.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: _buildScrollableHeader(context, isDark),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              sliver: widget.isLoading 
                ? const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
                : _localNotifications.isEmpty
                  ? SliverFillRemaining(
                      hasScrollBody: false,
                      child: _buildEmptyState(),
                    )
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => _buildNotificationCard(_localNotifications[index], isDark),
                        childCount: _localNotifications.length,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScrollableHeader(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.only(top: 45, bottom: 12),
      child: Row(
        children: [
          const SizedBox(width: 16),
          _buildCircleBackButton(isDark),
          Expanded(
            child: Text(
              Translations.get('notifications', widget.locale),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w900,
                fontSize: 24,
                letterSpacing: -0.5,
              ),
            ),
          ),
          const SizedBox(width: 48), // Balance for back button
          const SizedBox(width: 16),
        ],
      ),
    );
  }

  Widget _buildCircleBackButton(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade100,
        shape: BoxShape.circle,
      ),
      child: IconButton(
        icon: Icon(
          Icons.arrow_back_ios_new_rounded,
          color: isDark ? Colors.white : Colors.black87,
          size: 14,
        ),
        onPressed: widget.onBack,
      ),
    );
  }

  Widget _buildNotificationCard(dynamic note, bool isDark) {
    final type = note['type']?.toString() ?? 'general';
    final isRead = note['isRead'] == true;
    final amber = const Color(0xFFFFB000);
    
    IconData icon;
    Color typeColor;
    
    switch (type) {
      case 'quality_result':
        icon = LucideIcons.droplets;
        typeColor = isDark ? amber : AppTheme.primary;
        break;
      case 'payment':
        icon = LucideIcons.wallet;
        typeColor = Colors.green;
        break;
      case 'payment_reminder':
        icon = LucideIcons.calendar;
        typeColor = Colors.orange;
        break;
      case 'dispatch':
      case 'dispatch_status':
        icon = LucideIcons.truck;
        typeColor = isDark ? Colors.orangeAccent : Colors.orange;
        break;
      default:
        icon = LucideIcons.bell;
        typeColor = isDark ? amber : AppTheme.primary;
    }

    // Border color logic: Amber for unread in dark mode, Primary for unread in light mode
    final unreadBorderColor = isDark ? amber : AppTheme.primary;

    return GestureDetector(
      onTap: () {
        if (!isRead) _markAsRead(note['id'].toString());
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark 
              ? AppTheme.surfaceDark.withValues(alpha: isRead ? 0.3 : 0.7) 
              : (isRead ? Colors.white : Colors.white),
          borderRadius: BorderRadius.circular(24),
          boxShadow: isRead ? [] : [
            BoxShadow(
              color: unreadBorderColor.withValues(alpha: 0.1),
              blurRadius: 15,
              offset: const Offset(0, 5),
            )
          ],
          border: Border.all(
            color: isRead 
              ? (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade100)
              : unreadBorderColor.withValues(alpha: 0.4),
            width: isRead ? 1 : 2,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: typeColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: typeColor, size: 20),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _translate(note['title']),
                        style: TextStyle(
                          fontWeight: isRead ? FontWeight.bold : FontWeight.w900,
                          fontSize: 14,
                          color: isDark ? (isRead ? Colors.white70 : Colors.white) : (isRead ? Colors.black54 : Colors.black87),
                        ),
                      ),
                      if (!isRead && type != 'payment_reminder')
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFFFFB000) : const Color(0xFF1B264F),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: (isDark ? const Color(0xFFFFB000) : const Color(0xFF1B264F)).withValues(alpha: 0.2),
                                blurRadius: 8,
                                spreadRadius: 1,
                              )
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _translate(note['message']),
                    style: TextStyle(
                      color: isDark 
                          ? (isRead ? Colors.white24 : Colors.white60) 
                          : (isRead ? Colors.grey.shade400 : Colors.grey.shade800),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  if (type != 'payment_reminder') ...[
                    const SizedBox(height: 12),
                    Text(
                      DateFormat('MMM dd, yyyy • hh:mm a').format(DateTime.parse(note['createdAt']).toLocal()),
                      style: TextStyle(
                        color: isDark ? Colors.white12 : Colors.grey.shade400,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.bellOff, size: 64, color: Colors.grey.withValues(alpha: 0.2)),
          const SizedBox(height: 16),
          Text(
            Translations.get('no_notifications', widget.locale),
            style: TextStyle(
              color: Colors.grey.withValues(alpha: 0.5),
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
