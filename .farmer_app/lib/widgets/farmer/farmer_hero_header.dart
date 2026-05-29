import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../services/hero_background_service.dart';
import '../../services/translations.dart';
import '../../theme/design_tokens.dart';
import '../../widgets/profile_avatar.dart';
import '../bouncing_button.dart';
import 'farmer_scenic_background.dart';
import 'time_based_greeting.dart';

enum FarmerHeroLayout { embedded, scrollOverlay }

/// Hero toolbar + greeting overlay. Use [FarmerHeroLayout.scrollOverlay] with a
/// fixed [FarmerScenicBackground] (profile-style scroll).
class FarmerHeroContent extends StatelessWidget {
  final String locale;
  final String farmerName;
  final String farmerCode;
  final String? farmOrCenterName;
  final bool hasUnreadNotifications;
  final bool isDarkMode;
  final double? weatherCelsius;
  final String? weatherCondition;
  final VoidCallback onProfileTap;
  final VoidCallback onNotificationsTap;
  final VoidCallback onThemeToggle;
  final FarmerHeroLayout layout;
  final double bottomContentInset;

  const FarmerHeroContent({
    super.key,
    required this.locale,
    required this.farmerName,
    required this.farmerCode,
    this.farmOrCenterName,
    required this.hasUnreadNotifications,
    required this.isDarkMode,
    this.weatherCelsius,
    this.weatherCondition,
    required this.onProfileTap,
    required this.onNotificationsTap,
    required this.onThemeToggle,
    this.layout = FarmerHeroLayout.scrollOverlay,
    this.bottomContentInset = 88,
  });

  bool get _hasRealWeather => weatherCelsius != null;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    final toolbar = _buildToolbar();
    final greeting = _buildGreeting();

    if (layout == FarmerHeroLayout.embedded) {
      return Padding(
        padding: EdgeInsets.fromLTRB(20, topInset + 12, 20, bottomContentInset),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            toolbar,
            const Spacer(),
            greeting,
          ],
        ),
      );
    }

    final heroHeight = HeroBackgroundService.homeHeroHeight + topInset;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        toolbar,
        SizedBox(height: heroHeight - 196),
        greeting,
      ],
    );
  }

  Widget _buildToolbar() {
    return Row(
      children: [
        _HeroIconButton(
          onTap: onProfileTap,
          child: ProfileAvatar(radius: 22, locale: locale, editable: false),
        ),
        const Spacer(),
        if (_hasRealWeather) ...[
          _WeatherChip(
            emoji: HeroBackgroundService.weatherEmoji(weatherCondition),
            temperature: weatherCelsius!.round(),
            unit: Translations.get('celsius_unit', locale),
          ),
          const SizedBox(width: 8),
        ],
        _HeroIconButton(
          onTap: () {
            HapticFeedback.lightImpact();
            onThemeToggle();
          },
          icon: isDarkMode ? LucideIcons.sun : LucideIcons.moon,
        ),
        const SizedBox(width: 8),
        Stack(
          clipBehavior: Clip.none,
          children: [
            _HeroIconButton(
              onTap: () {
                HapticFeedback.lightImpact();
                onNotificationsTap();
              },
              icon: LucideIcons.bell,
            ),
            if (hasUnreadNotifications)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: AppColors.warning,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _buildGreeting() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TimeBasedGreeting(
          locale: locale,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.88),
            fontSize: 14,
            fontWeight: FontWeight.w600,
            shadows: const [
              Shadow(
                color: Color(0x66000000),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          farmerName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 26,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            shadows: [
              Shadow(
                color: Color(0x73000000),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.28),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            child: Row(
              children: [
                Icon(
                  LucideIcons.badgeCheck,
                  size: 14,
                  color: Colors.white.withValues(alpha: 0.92),
                ),
                const SizedBox(width: 6),
                Text(
                  farmerCode,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.95),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    shadows: const [
                      Shadow(
                        color: Color(0x99000000),
                        blurRadius: 6,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                ),
                if (farmOrCenterName != null && farmOrCenterName!.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Container(
                      width: 1,
                      height: 14,
                      color: Colors.white.withValues(alpha: 0.22),
                    ),
                  ),
                  Icon(
                    LucideIcons.mapPin,
                    size: 13,
                    color: Colors.white.withValues(alpha: 0.92),
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      farmOrCenterName!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.92),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        shadows: const [
                          Shadow(
                            color: Color(0x99000000),
                            blurRadius: 6,
                            offset: Offset(0, 1),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class FarmerHeroHeader extends StatelessWidget {
  final String locale;
  final String farmerName;
  final String farmerCode;
  final String? farmOrCenterName;
  final bool hasUnreadNotifications;
  final bool isDarkMode;
  final double? weatherCelsius;
  final String? weatherCondition;
  final VoidCallback onProfileTap;
  final VoidCallback onNotificationsTap;
  final VoidCallback onThemeToggle;

  const FarmerHeroHeader({
    super.key,
    required this.locale,
    required this.farmerName,
    required this.farmerCode,
    this.farmOrCenterName,
    required this.hasUnreadNotifications,
    required this.isDarkMode,
    this.weatherCelsius,
    this.weatherCondition,
    required this.onProfileTap,
    required this.onNotificationsTap,
    required this.onThemeToggle,
  });

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    final heroHeight = HeroBackgroundService.homeHeroHeight + topInset;

    return FarmerScenicBackground(
      height: heroHeight,
      weatherCondition: weatherCondition,
      headerReadable: true,
      child: FarmerHeroContent(
        layout: FarmerHeroLayout.embedded,
        locale: locale,
        farmerName: farmerName,
        farmerCode: farmerCode,
        farmOrCenterName: farmOrCenterName,
        hasUnreadNotifications: hasUnreadNotifications,
        isDarkMode: isDarkMode,
        weatherCelsius: weatherCelsius,
        weatherCondition: weatherCondition,
        onProfileTap: onProfileTap,
        onNotificationsTap: onNotificationsTap,
        onThemeToggle: onThemeToggle,
      ),
    );
  }
}

class _HeroIconButton extends StatelessWidget {
  final VoidCallback onTap;
  final IconData? icon;
  final Widget? child;

  const _HeroIconButton({
    required this.onTap,
    this.icon,
    this.child,
  });

  @override
  Widget build(BuildContext context) {
    return BouncingButton(
      onTap: onTap,
      child: ClipOval(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.22),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
            ),
            child: child ?? Icon(icon, color: Colors.white, size: 20),
          ),
        ),
      ),
    );
  }
}

class _WeatherChip extends StatelessWidget {
  final String emoji;
  final int temperature;
  final String unit;

  const _WeatherChip({
    required this.emoji,
    required this.temperature,
    required this.unit,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.24),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: Colors.white.withValues(alpha: 0.38)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 16, height: 1)),
              const SizedBox(width: 7),
              Text(
                '$temperature$unit',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                  shadows: [
                    Shadow(
                      color: Color(0x66000000),
                      blurRadius: 6,
                      offset: Offset(0, 1),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
