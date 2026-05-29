import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/design_tokens.dart';
import 'bouncing_button.dart';

/// Glass floating bottom navigation with pill active state.
class PremiumBottomNav extends StatelessWidget {
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

  const PremiumBottomNav({
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
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, bottom + 12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkSurface.withValues(alpha: 0.88)
                  : Colors.white.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.08)
                    : Colors.black.withValues(alpha: 0.06),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.12),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              children: [
                _tab(context, 0, Icons.home_outlined, Icons.home_rounded, homeLabel, showHomeBadge),
                _tab(context, 1, Icons.menu_book_outlined, Icons.menu_book_rounded, passbookLabel, showPassbookBadge),
                _tab(context, 2, Icons.account_balance_wallet_outlined, Icons.account_balance_wallet_rounded, paymentsLabel, showPaymentsBadge),
                _tab(context, 3, Icons.person_outline_rounded, Icons.person_rounded, profileLabel, showProfileBadge),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Expanded _tab(
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
    final inactive = isDark ? Colors.white54 : AppColors.deepForest.withValues(alpha: 0.45);

    return Expanded(
      child: BouncingButton(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap(index);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            color: active ? activeColor.withValues(alpha: isDark ? 0.22 : 0.14) : Colors.transparent,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(active ? filled : outline, color: active ? activeColor : inactive, size: 22),
                  if (badge)
                    Positioned(
                      right: -3,
                      top: -2,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppColors.warning,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.2),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 200),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                  color: active ? activeColor : inactive,
                ),
                child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
