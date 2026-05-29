import 'design_tokens.dart';
import '../services/hero_background_service.dart';

/// Bundled farm hero backgrounds (local assets only).
@Deprecated('Use HeroBackgroundService directly')
class HeroBackgroundImages {
  static String welcomeBackground() => HeroBackgroundService.welcomeBackground();

  static String forPeriod(AmbientPeriod period) =>
      HeroBackgroundService.timeFallbackAsset();

  static String? forWeatherCondition(String? condition) =>
      HeroBackgroundService.assetForWeatherCondition(condition);

  static String resolve({AmbientPeriod? period, String? weatherCondition}) {
    return HeroBackgroundService.resolve(weatherCondition: weatherCondition);
  }
}
