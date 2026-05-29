import 'package:flutter/material.dart';

/// Design tokens for Nestlé My Farming — UI layer only.
class AppColors {
  static const primaryGreen = Color(0xFF2D6A4F);
  static const deepForest = Color(0xFF1B4332);
  static const nestleBlue = Color(0xFF005EB8);
  static const warmCream = Color(0xFFFAF7F2);
  static const success = Color(0xFF2D6A4F);
  static const warning = Color(0xFFE9A319);
  static const error = Color(0xFFC1121F);
  static const darkBackground = Color(0xFF0A0F0D);
  static const darkSurface = Color(0xFF121A16);
  static const darkCard = Color(0xFF1C2822);
  static const darkAccent = Color(0xFF52B788);
  static const unreadLight = Color(0xFF005EB8);
  static const unreadDark = Color(0xFF6EC6FF);
}

class AppSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
  static const minTap = 44.0;
}

class AppRadii {
  static const sm = 12.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 28.0;
}

enum AmbientPeriod { morning, afternoon, evening, night }

enum AmbientWeather {
  sunny,
  cloudy,
  rainy,
  windy,
  misty,
}
