import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

/// Selects bundled hero backgrounds from [assets/images/farmer].
class HeroBackgroundService {
  HeroBackgroundService._();

  static const _dir = 'assets/images/farmer';

  static const welcome = '$_dir/welcome_farm.jpg';
  static const sunny = '$_dir/sunny_farm.jpg';
  static const sunset = '$_dir/sunset_farm.jpg';
  static const rainy = '$_dir/rainy_farm.jpg';
  static const stormy = '$_dir/stormy_farm.jpg';
  static const foggy = '$_dir/foggy_farm.jpg';
  static const windy = '$_dir/windy_farm.jpg';
  static const cloudy = '$_dir/cloudy_farm.jpg';
  static const night = '$_dir/night_farm.jpg';

  static const fallback = sunny;
  static const double homeHeroHeight = 400;
  static const double profileHeroHeight = 400;
  static const double homeHeroBlurSigma = 0.4;
  static const double welcomeHeroBlurSigma = 1.0;

  static String welcomeBackground() => welcome;

  static String assetFallback(String path) {
    if (path == welcome) return welcome;
    if (path == cloudy) return sunny;
    return fallback;
  }

  static bool isSunsetTime([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    return hour >= 16 && hour < 19;
  }

  static bool isNightTime([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    return hour >= 19 || hour < 5;
  }

  static bool isDaytime([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    return hour >= 5 && hour < 19;
  }

  static AmbientPeriod greetingPeriodForTime([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    if (hour >= 5 && hour < 12) return AmbientPeriod.morning;
    if (hour >= 12 && hour < 17) return AmbientPeriod.afternoon;
    if (hour >= 17 && hour < 21) return AmbientPeriod.evening;
    return AmbientPeriod.night;
  }

  static String timeFallbackAsset([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;

    if (hour >= 19 || hour < 5) return night;
    if (hour >= 16 && hour < 19) return sunset;
    return sunny;
  }

  static String _normalize(String? condition) =>
      condition?.toLowerCase().trim() ?? '';

  static bool _isStorm(String c) =>
      c.contains('storm') || c.contains('thunder') || c.contains('lightning');

  static bool _isRain(String c) =>
      RegExp(r'\brain\b|\brainy\b|\bdrizzle\b|\bshower\b|\bshowers\b').hasMatch(c);

  static bool _isFog(String c) =>
      c.contains('fog') ||
      c.contains('haze') ||
      RegExp(r'\bmist\b|\bmisty\b|\bhazy\b').hasMatch(c);

  static bool _isWind(String c) =>
      RegExp(r'\bwind\b|\bwindy\b|\bbreezy\b|\bbreeze\b').hasMatch(c);

  static bool _isClearOrSunny(String c) {
    if (c.isEmpty) return false;
    if (RegExp(r'\bmostly\s+sunny\b|\bmainly\s+clear\b').hasMatch(c)) return true;
    if (RegExp(r'\bclear\b|\bsunny\b|\bfair\b').hasMatch(c) && !c.contains('cloud')) {
      return true;
    }
    return false;
  }

  static bool _isCloudy(String c) {
    if (_isClearOrSunny(c)) return false;
    return RegExp(
      r'\bcloudy\b|\bovercast\b|\bpartly\s+cloudy\b|\bmostly\s+cloudy\b|\bclouds\b',
    ).hasMatch(c);
  }

  static String _clearSunnyAsset(DateTime now) {
    if (isNightTime(now)) return night;
    return sunny;
  }

  /// Emoji for weather chip — condition text is never shown in UI.
  static String weatherEmoji(String? condition, {DateTime? now}) {
    final c = _normalize(condition);
    final n = now ?? DateTime.now();

    if (_isStorm(c)) return '⛈️';
    if (_isRain(c)) return '🌧️';
    if (_isFog(c)) return '🌫️';
    if (_isWind(c)) return '🌬️';
    if (_isCloudy(c)) {
      if (c.contains('partly') || c.contains('mostly')) return '🌥️';
      return '☁️';
    }
    if (_isClearOrSunny(c)) {
      if (isNightTime(n)) return '🌙';
      if (c.contains('mostly') || c.contains('mainly') || c.contains('partly')) {
        return '🌤️';
      }
      return '☀️';
    }
    if (isNightTime(n)) return '🌙';
    return '🌤️';
  }

  static Alignment alignmentForAsset(String assetPath, {bool welcomeScreen = false}) {
    if (welcomeScreen || assetPath.endsWith('welcome_farm.jpg')) {
      return Alignment.center;
    }
    if (assetPath.endsWith('night_farm.jpg') ||
        assetPath.endsWith('sunset_farm.jpg') ||
        assetPath.endsWith('stormy_farm.jpg') ||
        assetPath.endsWith('windy_farm.jpg') ||
        assetPath.endsWith('cloudy_farm.jpg')) {
      return Alignment.center;
    }
    if (assetPath.endsWith('sunny_farm.jpg') ||
        assetPath.endsWith('rainy_farm.jpg') ||
        assetPath.endsWith('foggy_farm.jpg')) {
      return const Alignment(-0.30, 0);
    }
    return Alignment.center;
  }

  static String? assetForWeatherCondition(String? condition, {DateTime? now}) {
    final c = _normalize(condition);
    if (c.isEmpty) return null;
    final n = now ?? DateTime.now();

    if (_isStorm(c)) return stormy;
    if (_isRain(c)) return rainy;
    if (_isFog(c)) return foggy;
    if (_isWind(c)) return windy;
    if (_isCloudy(c)) return cloudy;
    if (_isClearOrSunny(c)) return _clearSunnyAsset(n);
    return null;
  }

  static String resolve({String? weatherCondition, DateTime? now}) {
    final weatherAsset = assetForWeatherCondition(weatherCondition, now: now);
    if (weatherAsset != null) return weatherAsset;
    return timeFallbackAsset(now);
  }
}
