import 'package:flutter/material.dart';
import '../theme/design_tokens.dart';

enum TimelineStepState { completed, active, upcoming, failed }

class TimelineStep extends StatelessWidget {
  final String title;
  final String? subtitle;
  final TimelineStepState state;
  final bool isLast;

  const TimelineStep({
    super.key,
    required this.title,
    this.subtitle,
    required this.state,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (circleColor, iconColor, lineColor) = _colors(isDark);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: circleColor,
                  shape: BoxShape.circle,
                  border: state == TimelineStepState.active
                      ? Border.all(color: iconColor, width: 2)
                      : null,
                ),
                child: Icon(_icon, size: 16, color: iconColor),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: lineColor,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: isDark ? Colors.white : AppColors.deepForest,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      subtitle!,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: isDark ? Colors.white60 : Colors.black54,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  IconData get _icon {
    switch (state) {
      case TimelineStepState.completed:
        return Icons.check_rounded;
      case TimelineStepState.failed:
        return Icons.close_rounded;
      case TimelineStepState.active:
        return Icons.radio_button_checked;
      case TimelineStepState.upcoming:
        return Icons.circle_outlined;
    }
  }

  (Color, Color, Color) _colors(bool isDark) {
    switch (state) {
      case TimelineStepState.completed:
        return (
          AppColors.success.withValues(alpha: 0.15),
          isDark ? AppColors.darkAccent : AppColors.success,
          AppColors.success.withValues(alpha: 0.35),
        );
      case TimelineStepState.failed:
        return (
          AppColors.error.withValues(alpha: 0.12),
          AppColors.error,
          AppColors.error.withValues(alpha: 0.25),
        );
      case TimelineStepState.active:
        return (
          AppColors.warning.withValues(alpha: 0.15),
          AppColors.warning,
          Colors.grey.withValues(alpha: 0.25),
        );
      case TimelineStepState.upcoming:
        return (
          isDark ? Colors.white10 : Colors.grey.shade100,
          isDark ? Colors.white38 : Colors.grey,
          Colors.grey.withValues(alpha: 0.2),
        );
    }
  }
}
