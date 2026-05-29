import 'package:flutter/material.dart';
import '../theme/design_tokens.dart';
import 'bouncing_button.dart';

class AppBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final String homeLabel;
  final String passbookLabel;
  final String paymentsLabel;
  final String profileLabel;
  final bool showHomeBadge;
  final bool showPassbookBadge;
  final bool showPaymentsBadge;
  final bool showProfileBadge;

  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.homeLabel,
    required this.passbookLabel,
    required this.paymentsLabel,
    required this.profileLabel,
    this.showHomeBadge = false,
    this.showPassbookBadge = false,
    this.showPaymentsBadge = false,
    this.showProfileBadge = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: EdgeInsets.only(
        top: 12,
        bottom: MediaQuery.paddingOf(context).bottom + 12,
        left: 8,
        right: 8,
      ),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurface.withValues(alpha: 0.95)
            : Colors.white.withValues(alpha: 0.96),
        border: Border(
          top: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.06)
                : Colors.black.withValues(alpha: 0.05),
          ),
        ),
      ),
      child: Row(
        children: [
          _item(context, 0, Icons.home_outlined, Icons.home_rounded, homeLabel, showHomeBadge),
          _item(context, 1, Icons.menu_book_outlined, Icons.menu_book_rounded, passbookLabel, showPassbookBadge),
          _item(context, 2, Icons.account_balance_wallet_outlined, Icons.account_balance_wallet_rounded, paymentsLabel, showPaymentsBadge),
          _item(context, 3, Icons.person_outline_rounded, Icons.person_rounded, profileLabel, showProfileBadge),
        ],
      ),
    );
  }

  Expanded _item(
    BuildContext context,
    int index,
    IconData outline,
    IconData filled,
    String label,
    bool badge,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final active = currentIndex >= 0 && currentIndex == index;
    final activeColor = isDark ? AppColors.darkAccent : AppColors.primaryGreen;
    final inactiveColor = isDark
        ? Colors.white.withValues(alpha: 0.45)
        : AppColors.deepForest.withValues(alpha: 0.45);

    return Expanded(
      child: BouncingButton(
        onTap: () => onTap(index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          decoration: BoxDecoration(
            color: active
                ? activeColor.withValues(alpha: isDark ? 0.15 : 0.1)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(
                    active ? filled : outline,
                    color: active ? activeColor : inactiveColor,
                    size: 24,
                  ),
                  if (badge)
                    Positioned(
                      right: -4,
                      top: -2,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.warning : AppColors.nestleBlue,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                  color: active ? activeColor : inactiveColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
