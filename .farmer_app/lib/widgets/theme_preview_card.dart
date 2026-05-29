import 'package:flutter/material.dart';
import '../theme/design_tokens.dart';

class ThemePreviewCard extends StatelessWidget {
  final String label;
  final bool selected;
  final bool isDarkPreview;
  final VoidCallback onTap;

  const ThemePreviewCard({
    super.key,
    required this.label,
    required this.selected,
    required this.isDarkPreview,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bg = isDarkPreview ? AppColors.darkBackground : AppColors.warmCream;
    final card = isDarkPreview ? AppColors.darkCard : Colors.white;
    final accent = isDarkPreview ? AppColors.darkAccent : AppColors.primaryGreen;

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: selected ? accent.withValues(alpha: 0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(
              color: selected ? accent : Colors.grey.withValues(alpha: 0.25),
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            children: [
              Container(
                height: 56,
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.black12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 6,
                        width: 32,
                        decoration: BoxDecoration(
                          color: accent,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      const Spacer(),
                      Container(
                        height: 16,
                        decoration: BoxDecoration(
                          color: card,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
