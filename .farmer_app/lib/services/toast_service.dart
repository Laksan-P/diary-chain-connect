import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../app_keys.dart';
import '../theme/design_tokens.dart';

class ToastService {
  static OverlayEntry? _entry;
  static Timer? _timer;

  static void show(
    BuildContext context,
    String message, {
    bool isError = false,
  }) {
    _dismiss();

    final overlayContext =
        navigatorKey.currentContext ?? context;
    final overlay = Overlay.maybeOf(overlayContext, rootOverlay: true) ??
        navigatorKey.currentState?.overlay;
    if (overlay == null) return;

    final isDark = Theme.of(overlayContext).brightness == Brightness.dark;
    final media = MediaQuery.of(overlayContext);
    final top = media.padding.top + 12;

    final backgroundColor = isError
        ? (isDark ? const Color(0xFF4A1519) : AppColors.error)
        : (isDark ? AppColors.deepForest : AppColors.primaryGreen);

    final iconBackground = isError
        ? Colors.white.withValues(alpha: 0.14)
        : (isDark
            ? AppColors.darkAccent.withValues(alpha: 0.22)
            : Colors.white.withValues(alpha: 0.18));

    final borderColor = isError
        ? AppColors.error.withValues(alpha: 0.45)
        : (isDark
            ? AppColors.darkAccent.withValues(alpha: 0.45)
            : Colors.white.withValues(alpha: 0.22));

    _entry = OverlayEntry(
      builder: (overlayContext) {
        return Positioned(
          top: top,
          left: 16,
          right: 16,
          child: Material(
            color: Colors.transparent,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOutCubic,
              builder: (context, value, child) {
                return Transform.translate(
                  offset: Offset(0, -16 * (1 - value)),
                  child: Opacity(opacity: value, child: child),
                );
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: backgroundColor,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: borderColor),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.18),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: iconBackground,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isError
                            ? LucideIcons.alertCircle
                            : LucideIcons.checkCircle2,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        message,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          height: 1.35,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );

    overlay.insert(_entry!);
    _timer = Timer(const Duration(seconds: 3), _dismiss);
  }

  static void _dismiss() {
    _timer?.cancel();
    _timer = null;
    _entry?.remove();
    _entry = null;
  }
}
