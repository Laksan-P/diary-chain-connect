import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  final void Function(String id)? onRead;
  final VoidCallback? onSupportTap;

  const NotificationsScreen({
    super.key,
    required this.notifications,
    required this.isLoading,
    required this.userId,
    required this.locale,
    required this.onBack,
    required this.onRefresh,
    this.onRead,
    this.onSupportTap,
  });

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _api = ApiService();
  late List<dynamic> _localNotifications;
  late List<dynamic> _filteredNotifications;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = "";

  @override
  void initState() {
    super.initState();
    _localNotifications = List.from(widget.notifications);
    _filteredNotifications = List.from(_localNotifications);
  }

  void _onSearch(String query) {
    setState(() {
      _searchQuery = query;
      if (query.isEmpty) {
        _filteredNotifications = List.from(_localNotifications);
      } else {
        _filteredNotifications = _localNotifications.where((n) {
          final title = _translateNotificationField(n, isTitle: true).toLowerCase();
          final message = _translateNotificationField(n, isTitle: false).toLowerCase();
          return title.contains(query.toLowerCase()) ||
              message.contains(query.toLowerCase());
        }).toList();
      }
    });
  }

  @override
  void didUpdateWidget(NotificationsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!mounted) return;

    // Smart merge: Sync local list if parent list changes, but preserve local "read" status
    if (widget.notifications != oldWidget.notifications) {
      setState(() {
        final newList = List.from(widget.notifications);
        for (var i = 0; i < newList.length; i++) {
          final id = newList[i]['id'].toString();
          // If we have this notification locally and it's marked as read, keep it read
          final localIdx = _localNotifications.indexWhere(
            (n) => n['id'].toString() == id,
          );
          if (localIdx != -1 &&
              _localNotifications[localIdx]['isRead'] == true) {
            newList[i]['isRead'] = true;
          }
        }
        _localNotifications = newList;
        _onSearch(_searchQuery);
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchNotifications({bool showLoader = true}) async {
    widget.onRefresh();
  }

  Future<void> _markAsRead(String id) async {
    // 1. Instant Local Update
    setState(() {
      final index = _localNotifications.indexWhere(
        (n) => n['id'].toString() == id,
      );
      if (index != -1) {
        _localNotifications[index]['isRead'] = true;
      }
    });

    // 2. Instant Parent Update (Consistency)
    widget.onRead?.call(id);

    // 3. Background API sync
    if (id.startsWith('local-')) return;

    try {
      await _api.patch('/notifications?action=mark-read&id=$id', {});
    } catch (e) {
      debugPrint("Error marking read: $e");
      // If API fails, we could revert but usually better to wait for next full refresh
      _fetchNotifications(showLoader: false);
    }
  }

  /// Convert legacy hardcoded English strings to translation key format
  String _migrateLegacy(String raw) {
    // Title mappings
    if (raw == 'Quality Test Passed') return 'quality_test_passed_title';
    if (raw == 'Quality Test Failed') return 'quality_test_failed_title';
    if (raw == 'Nestle Quality Pass' || raw == 'Milk Quality Verified by Nestlé') {
      return 'nestle_quality_pass_title';
    }
    if (raw == 'Nestle Quality Fail' ||
        raw == 'Nestle Quality Rejected' ||
        raw == 'Milk Quality Rejected by Nestlé') {
      return 'nestle_quality_rejected_title';
    }
    if (raw == 'nestle_quality_test_passed_title' ||
        raw == 'nestle_quality_pass_title') {
      return 'nestle_quality_pass_title';
    }
    if (raw == 'nestle_quality_test_failed_title' ||
        raw == 'nestle_quality_rejected_title') {
      return 'nestle_quality_rejected_title';
    }
    if (raw == 'Milk Dispatched') return 'milk_dispatched_title';
    if (raw == 'Dispatch Approved') return 'dispatch_approved_title';
    if (raw == 'Dispatch Rejected') return 'dispatch_rejected_title';

    // Nestlé verification: "Your milk collection on YYYY-MM-DD has passed Nestlé quality verification."
    final nestlePassMatch = RegExp(
      r'^Your milk collection on (\S+) has passed Nestlé quality verification\.$',
    ).firstMatch(raw);
    if (nestlePassMatch != null) {
      return 'nestle_quality_pass_msg|date:${nestlePassMatch.group(1)}';
    }

    // Nestlé verification fail
    final nestleFailMatch = RegExp(
      r'^Your milk collection on (\S+) did not pass Nestlé quality verification\. Reason: (.+)$',
    ).firstMatch(raw);
    if (nestleFailMatch != null) {
      return 'nestle_quality_rejected_msg|date:${nestleFailMatch.group(1)},reason:${nestleFailMatch.group(2)}';
    }

    // Legacy Nestlé messages
    final legacyNestlePassMatch = RegExp(
      r'^Final verification by Nestlé for your collection on (\S+) was successful\.$',
    ).firstMatch(raw);
    if (legacyNestlePassMatch != null) {
      return 'nestle_quality_pass_msg|date:${legacyNestlePassMatch.group(1)}';
    }

    final legacyNestleFailMatch = RegExp(
      r'^Final verification by Nestlé for your collection on (\S+) did not meet the required quality standard\.$',
    ).firstMatch(raw);
    if (legacyNestleFailMatch != null) {
      return 'nestle_quality_rejected_msg|date:${legacyNestleFailMatch.group(1)}';
    }

    final legacyNestleFailWithReasonMatch = RegExp(
      r'^Final verification by Nestlé for your collection on (\S+) failed\. Reason: (.+)$',
    ).firstMatch(raw);
    if (legacyNestleFailWithReasonMatch != null) {
      return 'nestle_quality_rejected_msg|date:${legacyNestleFailWithReasonMatch.group(1)},reason:${legacyNestleFailWithReasonMatch.group(2)}';
    }

    // Message: "Your milk collection on YYYY-MM-DD passed quality testing."
    final passMatch = RegExp(
      r'^Your milk collection on (\S+) passed quality testing\.$',
    ).firstMatch(raw);
    if (passMatch != null) {
      return 'quality_test_passed_msg|date:${passMatch.group(1)}';
    }

    // Message: "Your milk collection on YYYY-MM-DD failed quality testing. Reason: XXX"
    final failMatch = RegExp(
      r'^Your milk collection on (\S+) failed quality testing\. Reason: (.+)$',
    ).firstMatch(raw);
    if (failMatch != null) {
      return 'quality_test_failed_msg|date:${failMatch.group(1)},reason:${failMatch.group(2)}';
    }

    // Message: "Your milk collection on YYYY-MM-DD has been dispatched to Nestlé."
    final dispatchMatch = RegExp(
      r'^Your milk collection on (\S+) has been dispatched',
    ).firstMatch(raw);
    if (dispatchMatch != null) {
      return 'milk_dispatched_msg|date:${dispatchMatch.group(1)}';
    }

    // Message: "Your milk collection on YYYY-MM-DD was approved by Nestlé."
    final approveMatch = RegExp(
      r'^Your milk collection on (\S+) was approved',
    ).firstMatch(raw);
    if (approveMatch != null) {
      return 'dispatch_approved_msg|date:${approveMatch.group(1)}';
    }

    // Message: "Your milk collection on YYYY-MM-DD was rejected by Nestlé. Reason: XXX"
    final rejectMatch = RegExp(
      r'^Your milk collection on (\S+) was rejected.*Reason: (.+)$',
    ).firstMatch(raw);
    if (rejectMatch != null) {
      return 'dispatch_rejected_msg|date:${rejectMatch.group(1)},reason:${rejectMatch.group(2)}';
    }

    if (raw == 'dispatch_rejected_title') {
      return 'dispatch_rejected_title'; // Already a key
    }
    if (raw == 'Payment Received') return 'payment_received_title';
    if (raw == 'payment_received_title') return 'payment_received_title';

    // Raw translation keys stored without params (legacy / partial inserts)
    if (raw == 'payment_disbursed_cycle_msg' || raw == 'payment_disbursed_msg') {
      return raw;
    }
    if (raw == 'nestle_quality_pass_title' ||
        raw == 'nestle_quality_rejected_title' ||
        raw == 'nestle_quality_pass_msg' ||
        raw == 'nestle_quality_rejected_msg') {
      return raw;
    }

    final disbursedCycleMatch = RegExp(
      r'^Your payment of Rs\. (\S+) for (\S+) to (\S+) has been disbursed\.$',
    ).firstMatch(raw);
    if (disbursedCycleMatch != null) {
      return 'payment_disbursed_cycle_msg|amount:${disbursedCycleMatch.group(1)},cycleStart:${disbursedCycleMatch.group(2)},cycleEnd:${disbursedCycleMatch.group(3)}';
    }

    final disbursedMatch = RegExp(
      r'^Your payment of Rs\. (\S+) has been disbursed\.$',
    ).firstMatch(raw);
    if (disbursedMatch != null) {
      return 'payment_disbursed_msg|amount:${disbursedMatch.group(1)}';
    }

    // Message: "Payment of Rs. 129960.00 for 1083L of milk has been processed."
    final paymentMatch = RegExp(
      r'^Payment of Rs. (\S+) for (\S+)L of milk has been processed\.$',
    ).firstMatch(raw);
    if (paymentMatch != null) {
      return 'payment_received_msg|amount:${paymentMatch.group(1)},qty:${paymentMatch.group(2)}';
    }

    return raw; // No match — return original
  }

  String _formatNotificationDate(String raw) {
    if (raw.isEmpty) return raw;
    try {
      final date = DateTime.parse(raw);
      return DateFormat('MMM d, yyyy').format(date);
    } catch (_) {
      return raw;
    }
  }

  String _paymentFallback(String key, Map<String, String> params) {
    final amount = params['amount'] ?? '';
    if (key == 'payment_disbursed_cycle_msg' &&
        params.containsKey('cycleStart') &&
        params.containsKey('cycleEnd')) {
      return 'Your payment of Rs. $amount for ${params['cycleStart']} to ${params['cycleEnd']} has been disbursed.';
    }
    if (key == 'payment_disbursed_msg' || key == 'payment_disbursed_cycle_msg') {
      return 'Your payment of Rs. $amount has been disbursed.';
    }
    if (key == 'payment_received_title') {
      return 'Payment Received';
    }
    return key;
  }

  Map<String, String> _parseMessageParams(String paramStr) {
    final Map<String, String> params = {};
    for (var p in paramStr.split(',')) {
      final colonIdx = p.indexOf(':');
      if (colonIdx > 0) {
        params[p.substring(0, colonIdx).trim()] = p.substring(colonIdx + 1).trim();
      }
    }
    return params;
  }

  String get _locale {
    final code = widget.locale.split('_').first.split('-').first.toLowerCase();
    return code;
  }

  bool _looksLikeRawKey(String text) {
    if (text.isEmpty) return false;
    return RegExp(r'^[a-z][a-z0-9_]*_(title|msg)$').hasMatch(text);
  }

  String _canonicalKey(String key) {
    switch (key) {
      case 'nestle_quality_test_passed_title':
        return 'nestle_quality_pass_title';
      case 'nestle_quality_test_failed_title':
        return 'nestle_quality_rejected_title';
      case 'nestle_quality_test_passed_msg':
        return 'nestle_quality_pass_msg';
      case 'nestle_quality_test_failed_msg':
        return 'nestle_quality_rejected_msg';
      default:
        return key;
    }
  }

  Map<String, String> _extractNotificationParams(dynamic note) {
    final params = <String, String>{};

    for (final field in ['message', 'title']) {
      final text = note[field]?.toString() ?? '';
      if (!text.contains('|')) continue;
      params.addAll(_parseMessageParams(text.substring(text.indexOf('|') + 1)));
    }

    for (final dateKey in ['date', 'cycleStart', 'cycleEnd']) {
      if (params.containsKey(dateKey)) {
        params[dateKey] = _formatNotificationDate(params[dateKey]!);
      }
    }

    if (!params.containsKey('date') && note['createdAt'] != null) {
      try {
        final created = DateTime.parse(note['createdAt'].toString()).toLocal();
        params['date'] = _formatNotificationDate(
          DateFormat('yyyy-MM-dd').format(created),
        );
      } catch (_) {}
    }

    return params;
  }

  String _nestleQualityFallback(String key, Map<String, String> params) {
    final date = params['date'] ?? '';
    final hasDate = date.isNotEmpty;

    switch (_canonicalKey(key)) {
      case 'nestle_quality_pass_title':
        return 'Nestlé Quality Pass';
      case 'nestle_quality_rejected_title':
        return 'Nestlé Quality Rejected';
      case 'nestle_quality_pass_msg':
        return hasDate
            ? 'Final verification by Nestlé for your collection on $date was successful.'
            : 'Final verification by Nestlé was successful.';
      case 'nestle_quality_rejected_msg':
        return hasDate
            ? 'Final verification by Nestlé for your collection on $date did not meet the required quality standard.'
            : 'Final verification by Nestlé did not meet the required quality standard.';
      default:
        return key;
    }
  }

  String _fallbackForKey(String key, Map<String, String> params) {
    final canonical = _canonicalKey(key);

    final translated = Translations.get(
      canonical,
      _locale,
      params: params.isEmpty ? null : params,
    );
    if (translated != canonical) {
      return _stripUnresolvedPlaceholders(translated);
    }

    if (canonical.startsWith('nestle_quality_')) {
      return _nestleQualityFallback(canonical, params);
    }

    if (canonical.startsWith('payment_')) {
      final payment = _paymentFallback(canonical, params);
      if (payment != canonical) return payment;
    }

    return key;
  }

  String _stripUnresolvedPlaceholders(String text) {
    var resolved = text.replaceAll(RegExp(r'\s?\(on \{date\}\)'), '');
    resolved = resolved.replaceAll(RegExp(r'\{\w+\}'), '');
    resolved = resolved.replaceAll(RegExp(r'\s{2,}'), ' ');
    return resolved.trim();
  }

  String _translateNotificationField(dynamic note, {required bool isTitle}) {
    final raw = (isTitle ? note['title'] : note['message'])?.toString() ?? '';
    if (raw.isEmpty) return '';

    final params = _extractNotificationParams(note);
    final migrated = _migrateLegacy(raw);

    if (migrated.contains('|')) {
      final pipeIdx = migrated.indexOf('|');
      var key = _canonicalKey(migrated.substring(0, pipeIdx));
      final paramStr = migrated.substring(pipeIdx + 1);
      final mergedParams = {...params, ..._parseMessageParams(paramStr)};

      for (final dateKey in ['date', 'cycleStart', 'cycleEnd']) {
        if (mergedParams.containsKey(dateKey) &&
            RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(mergedParams[dateKey]!)) {
          mergedParams[dateKey] = _formatNotificationDate(mergedParams[dateKey]!);
        }
      }

      if (key == 'payment_disbursed_cycle_msg' &&
          (!mergedParams.containsKey('cycleStart') ||
              !mergedParams.containsKey('cycleEnd'))) {
        key = 'payment_disbursed_msg';
      }

      var resolved = Translations.get(key, _locale, params: mergedParams);
      if (resolved == key || _looksLikeRawKey(resolved)) {
        resolved = _fallbackForKey(key, mergedParams);
      }
      return _stripUnresolvedPlaceholders(resolved);
    }

    final key = _canonicalKey(migrated);
    var resolved = Translations.get(key, _locale, params: params.isEmpty ? null : params);
    if (resolved == key || _looksLikeRawKey(resolved)) {
      resolved = _fallbackForKey(key, params);
    }
    return _stripUnresolvedPlaceholders(resolved);
  }

  String _translate(String? raw, {Map<String, String>? params, dynamic note}) {
    if (raw == null || raw.isEmpty) return '';
    if (note != null) {
      return _translateNotificationField(
        note,
        isTitle: raw == note['title']?.toString(),
      );
    }

    final mergedParams = params ?? {};
    final migrated = _migrateLegacy(raw);

    if (migrated.contains('|')) {
      final pipeIdx = migrated.indexOf('|');
      var key = _canonicalKey(migrated.substring(0, pipeIdx));
      final paramStr = migrated.substring(pipeIdx + 1);
      final allParams = {...mergedParams, ..._parseMessageParams(paramStr)};

      for (final dateKey in ['date', 'cycleStart', 'cycleEnd']) {
        if (allParams.containsKey(dateKey)) {
          allParams[dateKey] = _formatNotificationDate(allParams[dateKey]!);
        }
      }

      if (key == 'payment_disbursed_cycle_msg' &&
          (!allParams.containsKey('cycleStart') ||
              !allParams.containsKey('cycleEnd'))) {
        key = 'payment_disbursed_msg';
      }

      var resolved = Translations.get(key, _locale, params: allParams);
      if (resolved == key || _looksLikeRawKey(resolved)) {
        resolved = _fallbackForKey(key, allParams);
      }
      return _stripUnresolvedPlaceholders(resolved);
    }

    final key = _canonicalKey(migrated);
    var resolved = Translations.get(
      key,
      _locale,
      params: mergedParams.isEmpty ? null : mergedParams,
    );
    if (resolved == key || _looksLikeRawKey(resolved)) {
      resolved = _fallbackForKey(key, mergedParams);
    }
    return _stripUnresolvedPlaceholders(resolved);
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
            SliverToBoxAdapter(child: _buildScrollableHeader(context, isDark)),
            SliverToBoxAdapter(child: _buildSearchBar(isDark)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              sliver: widget.isLoading
                  ? const SliverFillRemaining(
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : _filteredNotifications.isEmpty
                  ? SliverFillRemaining(
                      hasScrollBody: false,
                      child: _buildEmptyState(),
                    )
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => _buildNotificationCard(
                          _filteredNotifications[index],
                          isDark,
                        ),
                        childCount: _filteredNotifications.length,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.05)
                  : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.grey.shade200,
              ),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearch,
              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
              decoration: InputDecoration(
                hintText: 'Search Archive...',
                hintStyle: TextStyle(
                  color: isDark ? Colors.white24 : Colors.grey,
                ),
                border: InputBorder.none,
                icon: Icon(
                  LucideIcons.search,
                  size: 18,
                  color: isDark ? Colors.white24 : Colors.grey,
                ),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          _onSearch('');
                        },
                      )
                    : null,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                Icon(
                  LucideIcons.database,
                  size: 12,
                  color: isDark ? Colors.white24 : Colors.grey,
                ),
                const SizedBox(width: 6),
                Text(
                  'LOCAL ARCHIVE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                    color: isDark ? Colors.white24 : Colors.grey,
                  ),
                ),
              ],
            ),
          ),
        ],
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
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.grey.shade100,
        shape: BoxShape.circle,
      ),
      child: IconButton(
        icon: Icon(
          Icons.arrow_back_ios_new_rounded,
          color: isDark ? Colors.white : Colors.black87,
          size: 14,
        ),
        onPressed: () {
          HapticFeedback.lightImpact();
          widget.onBack();
        },
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
        HapticFeedback.lightImpact();
        if (!isRead) _markAsRead(note['id'].toString());

        // If it's a support reply notification, navigate to support chat
        if (note['message']?.toString().contains('custom_issue_feedback') ==
            true) {
          widget.onSupportTap?.call();
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark
              ? AppTheme.surfaceDark.withValues(alpha: isRead ? 0.3 : 0.7)
              : (isRead ? Colors.white : Colors.white),
          borderRadius: BorderRadius.circular(24),
          boxShadow: isRead
              ? []
              : [
                  BoxShadow(
                    color: unreadBorderColor.withValues(alpha: 0.1),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  ),
                ],
          border: Border.all(
            color: isRead
                ? (isDark
                      ? Colors.white.withValues(alpha: 0.05)
                      : Colors.grey.shade100)
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
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          _translateNotificationField(note, isTitle: true),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: isRead
                                ? FontWeight.bold
                                : FontWeight.w900,
                            fontSize: 14,
                            color: isDark
                                ? (isRead ? Colors.white70 : Colors.white)
                                : (isRead ? Colors.black54 : Colors.black87),
                          ),
                        ),
                      ),
                      if (!isRead && type != 'payment_reminder')
                        Padding(
                          padding: const EdgeInsets.only(left: 8, top: 2),
                          child: Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: isDark
                                  ? const Color(0xFFFFB000)
                                  : const Color(0xFF1B264F),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color:
                                      (isDark
                                              ? const Color(0xFFFFB000)
                                              : const Color(0xFF1B264F))
                                          .withValues(alpha: 0.2),
                                  blurRadius: 8,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _translateNotificationField(note, isTitle: false),
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isDark
                          ? (isRead ? Colors.white24 : Colors.white60)
                          : (isRead
                                ? Colors.grey.shade400
                                : Colors.grey.shade800),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    DateFormat(
                      'MMM dd, yyyy • hh:mm a',
                    ).format(DateTime.parse(note['createdAt']).toLocal()),
                    style: TextStyle(
                      color: isDark ? Colors.white12 : Colors.grey.shade400,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
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
          Icon(
            LucideIcons.bellOff,
            size: 64,
            color: Colors.grey.withValues(alpha: 0.2),
          ),
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
