import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/offline_service.dart';
import '../services/translations.dart';
import '../theme/design_tokens.dart';

/// Shows when the device is offline. Use [overlay] on the home shell; inline elsewhere.
class OfflineBanner extends StatelessWidget {
  final String locale;
  final EdgeInsets? padding;
  final bool overlay;

  const OfflineBanner({
    super.key,
    required this.locale,
    this.padding,
    this.overlay = false,
  });

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<bool>(
      stream: OfflineService().connectivityStream,
      initialData: OfflineService().isOnline,
      builder: (context, snapshot) {
        final isOnline = snapshot.data ?? true;

        if (overlay) {
          return _OfflineOverlayBanner(
            locale: locale,
            isOnline: isOnline,
          );
        }

        return _OfflineInlineBanner(
          locale: locale,
          isOnline: isOnline,
          padding: padding,
        );
      },
    );
  }
}

class _OfflineOverlayBanner extends StatelessWidget {
  final String locale;
  final bool isOnline;

  const _OfflineOverlayBanner({
    required this.locale,
    required this.isOnline,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return IgnorePointer(
      ignoring: isOnline,
      child: AnimatedSlide(
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
        offset: isOnline ? const Offset(0, -1.15) : Offset.zero,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 320),
          opacity: isOnline ? 0 : 1,
          child: Material(
            color: Colors.transparent,
            elevation: isOnline ? 0 : 8,
            shadowColor: Colors.black.withValues(alpha: 0.35),
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                child: _OfflineBannerCard(
                  locale: locale,
                  isDark: isDark,
                  compact: true,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OfflineInlineBanner extends StatelessWidget {
  final String locale;
  final bool isOnline;
  final EdgeInsets? padding;

  const _OfflineInlineBanner({
    required this.locale,
    required this.isOnline,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AnimatedSize(
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: isOnline
          ? const SizedBox.shrink()
          : Padding(
              padding: padding ?? const EdgeInsets.symmetric(horizontal: 16),
              child: Padding(
                padding: const EdgeInsets.only(top: 12, bottom: 4),
                child: _OfflineBannerCard(
                  locale: locale,
                  isDark: isDark,
                  compact: false,
                ),
              ),
            ),
    );
  }
}

class _OfflineBannerCard extends StatelessWidget {
  final String locale;
  final bool isDark;
  final bool compact;

  const _OfflineBannerCard({
    required this.locale,
    required this.isDark,
    required this.compact,
  });

  @override
  Widget build(BuildContext context) {
    final background = isDark
        ? AppColors.deepForest.withValues(alpha: 0.94)
        : AppColors.nestleBlue.withValues(alpha: 0.08);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.14)
        : AppColors.nestleBlue.withValues(alpha: 0.18);
    final iconBg = isDark
        ? Colors.white.withValues(alpha: 0.12)
        : AppColors.nestleBlue.withValues(alpha: 0.12);
    final titleColor = isDark ? Colors.white : AppColors.deepForest;
    final subtitleColor = isDark
        ? Colors.white.withValues(alpha: 0.72)
        : AppColors.deepForest.withValues(alpha: 0.65);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(compact ? 16 : 20),
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.28 : 0.08),
            blurRadius: compact ? 16 : 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          vertical: compact ? 10 : 12,
          horizontal: compact ? 14 : 20,
        ),
        child: Row(
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: iconBg,
                shape: BoxShape.circle,
              ),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Icon(
                  LucideIcons.wifiOff,
                  color: isDark ? Colors.white : AppColors.nestleBlue,
                  size: compact ? 15 : 16,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    Translations.get('offline_mode_msg', locale),
                    style: TextStyle(
                      color: titleColor,
                      fontSize: compact ? 12.5 : 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    Translations.get('offline_sync_resume', locale),
                    style: TextStyle(
                      color: subtitleColor,
                      fontSize: compact ? 10 : 10.5,
                      fontWeight: FontWeight.w500,
                      height: 1.2,
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
}
