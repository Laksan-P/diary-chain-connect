import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../services/translations.dart';
import '../../theme/design_tokens.dart';
import '../status_chip.dart';

class TodaysMilkHeroCard extends StatelessWidget {
  final String locale;
  final double totalLiters;
  final double? avgFat;
  final String? qualityDisplayKey;
  final String? collectionDisplayKey;
  final String? failureReason;
  final double? monthlyLitersTarget;
  final VoidCallback? onTap;

  final bool overlapHero;

  const TodaysMilkHeroCard({
    super.key,
    required this.locale,
    required this.totalLiters,
    this.avgFat,
    this.qualityDisplayKey,
    this.collectionDisplayKey,
    this.failureReason,
    this.monthlyLitersTarget,
    this.onTap,
    this.overlapHero = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasData = totalLiters > 0;
    final progress = (monthlyLitersTarget != null && monthlyLitersTarget! > 0)
        ? (totalLiters / monthlyLitersTarget!).clamp(0.0, 1.0)
        : null;
    final cardColor = isDark ? AppColors.darkCard : Colors.white;
    final borderRadius = BorderRadius.circular(AppRadii.xl);
    final labelStyle = TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w600,
      color: isDark ? Colors.white.withValues(alpha: 0.88) : AppColors.deepForest,
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        boxShadow: [
          BoxShadow(
            color: AppColors.deepForest.withValues(alpha: isDark ? 0.35 : 0.12),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Material(
        color: cardColor,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: borderRadius,
          side: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.black.withValues(alpha: 0.06),
          ),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: borderRadius,
          hoverColor: isDark
              ? Colors.white.withValues(alpha: 0.05)
              : AppColors.deepForest.withValues(alpha: 0.04),
          splashColor: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : AppColors.deepForest.withValues(alpha: 0.06),
          highlightColor: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Translations.get('todays_milk_collection', locale),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.82)
                        : AppColors.deepForest.withValues(alpha: 0.72),
                  ),
                ),
                const SizedBox(height: 12),
                if (!hasData) ...[
                  Row(
                    children: [
                      Icon(
                        LucideIcons.droplets,
                        size: 28,
                        color: isDark
                            ? Colors.white.withValues(alpha: 0.38)
                            : AppColors.deepForest.withValues(alpha: 0.35),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          Translations.get('no_collection_recorded_today', locale),
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            height: 1.35,
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.88)
                                : AppColors.deepForest.withValues(alpha: 0.85),
                          ),
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Flexible(
                              child: Text(
                                totalLiters.toStringAsFixed(1),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 40,
                                  fontWeight: FontWeight.w900,
                                  height: 1,
                                  letterSpacing: -1,
                                  color: isDark ? Colors.white : AppColors.deepForest,
                                ),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(left: 6, bottom: 6),
                              child: Text(
                                Translations.get('liters_short', locale),
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: isDark
                                      ? Colors.white.withValues(alpha: 0.72)
                                      : AppColors.deepForest.withValues(alpha: 0.55),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (avgFat != null)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              Translations.get('todays_fat', locale),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isDark
                                    ? Colors.white.withValues(alpha: 0.72)
                                    : AppColors.deepForest.withValues(alpha: 0.65),
                              ),
                            ),
                            Text(
                              '${avgFat!.toStringAsFixed(1)}%',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: isDark ? AppColors.darkAccent : AppColors.primaryGreen,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                  if (qualityDisplayKey != null ||
                      collectionDisplayKey != null) ...[
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (qualityDisplayKey != null) ...[
                          Text(
                            '${Translations.get('quality_status', locale)}:',
                            style: labelStyle,
                          ),
                          StatusChip(
                            status: qualityDisplayKey!,
                            displayKey: qualityDisplayKey,
                            locale: locale,
                            compact: true,
                          ),
                        ],
                        if (collectionDisplayKey != null) ...[
                          Text(
                            '${Translations.get('collection_status', locale)}:',
                            style: labelStyle,
                          ),
                          StatusChip(
                            status: collectionDisplayKey!,
                            displayKey: collectionDisplayKey,
                            locale: locale,
                            compact: true,
                          ),
                        ],
                      ],
                    ),
                  ],
                  if (failureReason != null && failureReason!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: isDark ? 0.14 : 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.error.withValues(alpha: 0.18),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            LucideIcons.alertCircle,
                            size: 16,
                            color: AppColors.error,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              failureReason!,
                              style: TextStyle(
                                fontSize: 12,
                                height: 1.4,
                                fontWeight: FontWeight.w600,
                                color: isDark
                                    ? Colors.white.withValues(alpha: 0.88)
                                    : AppColors.deepForest.withValues(alpha: 0.85),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (progress != null) ...[
                    const SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 8,
                        backgroundColor: AppColors.primaryGreen.withValues(alpha: 0.12),
                        color: AppColors.primaryGreen,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      Translations.get('daily_progress_hint', locale),
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark
                            ? Colors.white.withValues(alpha: 0.65)
                            : AppColors.deepForest.withValues(alpha: 0.55),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
