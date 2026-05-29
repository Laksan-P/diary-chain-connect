import 'package:flutter/material.dart';
import 'design_tokens.dart';
import '../services/hero_background_service.dart';

/// Visual-only ambient styling based on time of day (and optional weather label).
class AmbientTheme {
  static AmbientPeriod periodForTime([DateTime? now]) =>
      HeroBackgroundService.greetingPeriodForTime(now);

  static LinearGradient headerGradient(
    BuildContext context, {
    DateTime? now,
    AmbientWeather weather = AmbientWeather.sunny,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final period = periodForTime(now);

    if (isDark) {
      return _darkGradient(period, weather);
    }
    return _lightGradient(period, weather);
  }

  static LinearGradient _lightGradient(AmbientPeriod period, AmbientWeather weather) {
    if (weather == AmbientWeather.rainy) {
      return const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF5C6B7A), Color(0xFF3D4F5F)],
      );
    }
    if (weather == AmbientWeather.misty) {
      return const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF8BA4B4), Color(0xFF6B8494)],
      );
    }
    switch (period) {
      case AmbientPeriod.morning:
        return const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2D6A4F), Color(0xFFE9A319)],
        );
      case AmbientPeriod.afternoon:
        return const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF005EB8), Color(0xFF2D6A4F)],
        );
      case AmbientPeriod.evening:
        return const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF9A3412), Color(0xFF1B4332)],
        );
      case AmbientPeriod.night:
        return const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1B4332), Color(0xFF0A0F0D)],
        );
    }
  }

  static LinearGradient _darkGradient(AmbientPeriod period, AmbientWeather weather) {
    if (weather == AmbientWeather.rainy) {
      return const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF1A2530), Color(0xFF121A16)],
      );
    }
    switch (period) {
      case AmbientPeriod.morning:
        return const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1C3829), Color(0xFF121A16)],
        );
      case AmbientPeriod.afternoon:
        return const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF12324F), Color(0xFF121A16)],
        );
      case AmbientPeriod.evening:
        return const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF3D2314), Color(0xFF121A16)],
        );
      case AmbientPeriod.night:
        return const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0A0F0D), Color(0xFF121A16)],
        );
    }
  }

  static Color scaffoldTint(BuildContext context, {DateTime? now}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (isDark) return AppColors.darkBackground;
    switch (periodForTime(now)) {
      case AmbientPeriod.morning:
        return const Color(0xFFFBF8F3);
      case AmbientPeriod.afternoon:
        return AppColors.warmCream;
      case AmbientPeriod.evening:
        return const Color(0xFFFDF6F0);
      case AmbientPeriod.night:
        return const Color(0xFFF5F7FA);
    }
  }
}
