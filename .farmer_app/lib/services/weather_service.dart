import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_service.dart';
import 'offline_service.dart';

/// Live weather snapshot — never fakes values when data is unavailable.
class WeatherSnapshot {
  final double celsius;
  final String condition;

  const WeatherSnapshot({required this.celsius, required this.condition});

  bool get isValid => celsius.isFinite && !celsius.isNaN;
}

class WeatherService {
  final ApiService _api = ApiService();

  /// Fetches real weather: live Open-Meteo first, backend config as fallback.
  Future<WeatherSnapshot?> fetch({Map<String, dynamic>? user}) async {
    if (!OfflineService().isOnline) return null;

    try {
      final fromOpenMeteo = await _fetchFromOpenMeteo(user);
      if (fromOpenMeteo != null) return fromOpenMeteo;

      return await _fetchFromConfig();
    } catch (_) {
      return null;
    }
  }

  Future<WeatherSnapshot?> _fetchFromConfig() async {
    try {
      final tempRes = await _api.get('/config?key=farmer_weather_temp');
      final condRes = await _api.get('/config?key=farmer_weather_condition');

      final tempRaw = _readConfigValue(tempRes);
      final condition = _readConfigValue(condRes)?.trim();

      if (tempRaw == null) return null;

      final celsius = double.tryParse(tempRaw);
      if (celsius == null) return null;

      return WeatherSnapshot(celsius: celsius, condition: condition ?? '');
    } catch (_) {
      return null;
    }
  }

  Future<WeatherSnapshot?> _fetchFromOpenMeteo(Map<String, dynamic>? user) async {
    final query = _locationQuery(user);
    final coords = await _geocode(query);
    if (coords == null) return null;

    final uri = Uri.parse(
      'https://api.open-meteo.com/v1/forecast'
      '?latitude=${coords.latitude}'
      '&longitude=${coords.longitude}'
      '&current=temperature_2m,weather_code,wind_speed_10m'
      '&timezone=auto',
    );

    final response = await http.get(uri).timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) return null;

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final current = data['current'] as Map<String, dynamic>?;
    if (current == null) return null;

    final temp = current['temperature_2m'];
    final code = current['weather_code'];
    final wind = current['wind_speed_10m'];

    if (temp == null || code == null) return null;

    final celsius = (temp as num).toDouble();
    final condition = _conditionLabel(
      (code as num).toInt(),
      wind is num ? wind.toDouble() : null,
    );

    return WeatherSnapshot(celsius: celsius, condition: condition);
  }

  String _locationQuery(Map<String, dynamic>? user) {
    if (user == null) return 'Colombo';

    final candidates = <String>[
      user['chillingCenterName']?.toString() ?? '',
      user['address']?.toString() ?? '',
      user['city']?.toString() ?? '',
      user['district']?.toString() ?? '',
    ];

    for (final raw in candidates) {
      final value = raw.trim();
      if (value.isEmpty) continue;
      final firstPart = value.split(',').first.trim();
      if (firstPart.isNotEmpty) return firstPart;
    }

    return 'Colombo';
  }

  Future<({double latitude, double longitude})?> _geocode(String query) async {
    final uri = Uri.parse(
      'https://geocoding-api.open-meteo.com/v1/search'
      '?name=${Uri.encodeQueryComponent(query)}'
      '&count=1'
      '&language=en'
      '&format=json',
    );

    final response = await http.get(uri).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) return null;

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final results = data['results'] as List<dynamic>?;
    if (results == null || results.isEmpty) {
      if (query.toLowerCase() != 'colombo') {
        return _geocode('Colombo');
      }
      return const (latitude: 6.9271, longitude: 79.8612);
    }

    final first = results.first as Map<String, dynamic>;
    final lat = first['latitude'];
    final lon = first['longitude'];
    if (lat is! num || lon is! num) return null;

    return (latitude: lat.toDouble(), longitude: lon.toDouble());
  }

  String _conditionLabel(int weatherCode, double? windKmh) {
    if (windKmh != null && windKmh >= 35) return 'Windy';

    switch (weatherCode) {
      case 0:
        return 'Clear';
      case 1:
        return 'Mostly sunny';
      case 2:
        return 'Partly cloudy';
      case 3:
        return 'Overcast';
    }

    if (weatherCode >= 45 && weatherCode <= 48) return 'Foggy';
    if (weatherCode >= 51 && weatherCode <= 67) return 'Rainy';
    if (weatherCode >= 80 && weatherCode <= 82) return 'Rainy';
    if (weatherCode >= 95) return 'Stormy';
    if (weatherCode >= 71 && weatherCode <= 77) return 'Rainy';

    return 'Cloudy';
  }

  String? _readConfigValue(dynamic res) {
    if (res == null) return null;
    if (res is Map) {
      return res['config_value']?.toString() ?? res['value']?.toString();
    }
    return res.toString();
  }
}
