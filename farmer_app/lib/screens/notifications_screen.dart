import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/api_service.dart';
import '../services/translations.dart';
import 'app_theme.dart';

class NotificationsScreen extends StatefulWidget {
  final String userId;
  final String locale;
  final VoidCallback onBack;

  const NotificationsScreen({
    super.key,
    required this.userId,
    required this.locale,
    required this.onBack,
  });

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _api = ApiService();
  List<dynamic> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
  }

  Future<void> _fetchNotifications() async {
    setState(() => _isLoading = true);
    try {
      final data = await _api.get('/notifications?action=list&userId=${widget.userId}');
      if (mounted) {
        setState(() {
          _notifications = data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _markAsRead(String id) async {
    try {
      await _api.patch('/notifications?action=mark-read&id=$id', {});
      _fetchNotifications();
    } catch (e) {
      debugPrint("Error marking read: $e");
    }
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
              sliver: _isLoading 
                ? const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
                : _notifications.isEmpty
                  ? SliverFillRemaining(
                      hasScrollBody: false,
                      child: _buildEmptyState(),
                    )
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => _buildNotificationCard(_notifications[index], isDark),
                        childCount: _notifications.length,
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
                        note['title'] ?? 'Notification',
                        style: TextStyle(
                          fontWeight: isRead ? FontWeight.bold : FontWeight.w900,
                          fontSize: 14,
                          color: isDark ? (isRead ? Colors.white70 : Colors.white) : (isRead ? Colors.black54 : Colors.black87),
                        ),
                      ),
                      if (!isRead)
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
                    note['message'] ?? '',
                    style: TextStyle(
                      color: isDark 
                          ? (isRead ? Colors.white24 : Colors.white60) 
                          : (isRead ? Colors.grey.shade400 : Colors.grey.shade800),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    DateFormat('MMM dd, yyyy • hh:mm a').format(DateTime.parse(note['createdAt'])),
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
