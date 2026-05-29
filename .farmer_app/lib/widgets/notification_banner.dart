import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../theme/design_tokens.dart';

class InAppNotificationData {
  final String title;
  final String message;
  final IconData icon;
  final Color accentColor;

  const InAppNotificationData({
    required this.title,
    required this.message,
    this.icon = LucideIcons.bell,
    this.accentColor = AppColors.nestleBlue,
  });
}

/// Premium in-app notification banner — presentation only.
class NotificationBanner extends StatefulWidget {
  final InAppNotificationData data;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  const NotificationBanner({
    super.key,
    required this.data,
    required this.onTap,
    required this.onDismiss,
  });

  @override
  State<NotificationBanner> createState() => _NotificationBannerState();
}

class _NotificationBannerState extends State<NotificationBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slide;
  Timer? _autoDismiss;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _slide = Tween<Offset>(
      begin: const Offset(0, -1.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    _controller.forward();
    _autoDismiss = Timer(const Duration(seconds: 4), widget.onDismiss);
  }

  @override
  void dispose() {
    _autoDismiss?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _dismiss() async {
    _autoDismiss?.cancel();
    await _controller.reverse();
    widget.onDismiss();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final width = MediaQuery.sizeOf(context).width;
    final hasDynamicIsland = top > 50;
    final hasNotch = top > 40 && !hasDynamicIsland;

    final horizontal = hasDynamicIsland ? width * 0.12 : 16.0;
    final topOffset = top + (hasDynamicIsland ? 6 : hasNotch ? 8 : 12);

    Widget banner = Material(
      color: Colors.transparent,
      child: GestureDetector(
        onVerticalDragEnd: (d) {
          if (d.velocity.pixelsPerSecond.dy < -200) _dismiss();
        },
        onTap: () {
          HapticFeedback.lightImpact();
          widget.onTap();
          _dismiss();
        },
        child: ClipRRect(
          borderRadius: BorderRadius.circular(hasDynamicIsland ? 28 : 20),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppColors.darkCard.withValues(alpha: 0.92)
                    : Colors.white.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(hasDynamicIsland ? 28 : 20),
                border: Border.all(
                  color: widget.data.accentColor.withValues(alpha: 0.25),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: widget.data.accentColor.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(widget.data.icon, size: 18, color: widget.data.accentColor),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.data.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          widget.data.message,
                          maxLines: 4,
                          softWrap: true,
                          style: TextStyle(
                            fontSize: 12,
                            height: 1.35,
                            color: Theme.of(context).brightness == Brightness.dark
                                ? Colors.white70
                                : Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    if (hasDynamicIsland) {
      banner = Center(
        child: SizedBox(width: width * 0.76, child: banner),
      );
    }

    return Positioned(
      top: topOffset,
      left: hasDynamicIsland ? 0 : horizontal,
      right: hasDynamicIsland ? 0 : horizontal,
      child: SlideTransition(
        position: _slide,
        child: banner,
      ),
    );
  }
}
