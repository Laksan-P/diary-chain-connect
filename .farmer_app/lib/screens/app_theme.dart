import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/ambient_theme.dart';
import '../theme/design_tokens.dart';

class AppThemeExtension extends ThemeExtension<AppThemeExtension> {
  final Color success;
  final Color warning;
  final Color error;
  final Color unread;

  const AppThemeExtension({
    required this.success,
    required this.warning,
    required this.error,
    required this.unread,
  });

  @override
  AppThemeExtension copyWith({
    Color? success,
    Color? warning,
    Color? error,
    Color? unread,
  }) {
    return AppThemeExtension(
      success: success ?? this.success,
      warning: warning ?? this.warning,
      error: error ?? this.error,
      unread: unread ?? this.unread,
    );
  }

  @override
  AppThemeExtension lerp(ThemeExtension<AppThemeExtension>? other, double t) {
    if (other is! AppThemeExtension) return this;
    return AppThemeExtension(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
      unread: Color.lerp(unread, other.unread, t)!,
    );
  }
}

class AppTheme {
  // Backward-compatible aliases
  static const Color primary = AppColors.deepForest;
  static const Color primaryLight = AppColors.darkAccent;
  static const Color accent = AppColors.nestleBlue;
  static const Color backgroundLight = AppColors.warmCream;
  static const Color backgroundDark = AppColors.darkBackground;
  static const Color surfaceDark = AppColors.darkSurface;

  static List<BoxShadow> premiumShadow = [
    BoxShadow(
      color: AppColors.deepForest.withValues(alpha: 0.06),
      blurRadius: 20,
      offset: const Offset(0, 8),
    ),
  ];

  static LinearGradient getHeaderGradient(BuildContext context) {
    return AmbientTheme.headerGradient(context);
  }

  static TextTheme _textTheme(Brightness brightness) {
    final base = brightness == Brightness.dark
        ? ThemeData.dark().textTheme
        : ThemeData.light().textTheme;
    return GoogleFonts.interTextTheme(base).copyWith(
      displaySmall: GoogleFonts.inter(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
      ),
      titleLarge: GoogleFonts.inter(
        fontSize: 22,
        fontWeight: FontWeight.w700,
      ),
      titleMedium: GoogleFonts.inter(
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: GoogleFonts.inter(fontSize: 16, height: 1.45),
      bodyMedium: GoogleFonts.inter(fontSize: 15, height: 1.45),
      labelLarge: GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  static ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    primaryColor: AppColors.primaryGreen,
    scaffoldBackgroundColor: AppColors.warmCream,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primaryGreen,
      primary: AppColors.primaryGreen,
      onPrimary: Colors.white,
      secondary: AppColors.nestleBlue,
      surface: Colors.white,
      onSurface: AppColors.deepForest,
      error: AppColors.error,
    ),
    textTheme: _textTheme(Brightness.light),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
    ),
    extensions: const [
      AppThemeExtension(
        success: AppColors.success,
        warning: AppColors.warning,
        error: AppColors.error,
        unread: AppColors.unreadLight,
      ),
    ],
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.deepForest,
      contentTextStyle: const TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.w600,
      ),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      elevation: 8,
    ),
  );

  static ThemeData darkTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    primaryColor: AppColors.darkAccent,
    scaffoldBackgroundColor: AppColors.darkBackground,
    colorScheme: ColorScheme.fromSeed(
      brightness: Brightness.dark,
      seedColor: AppColors.darkAccent,
      primary: AppColors.darkAccent,
      onPrimary: AppColors.darkBackground,
      secondary: AppColors.nestleBlue,
      surface: AppColors.darkSurface,
      onSurface: Colors.white,
      error: AppColors.error,
    ),
    textTheme: _textTheme(Brightness.dark),
    cardTheme: CardThemeData(
      color: AppColors.darkCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
    ),
    extensions: const [
      AppThemeExtension(
        success: AppColors.darkAccent,
        warning: AppColors.warning,
        error: AppColors.error,
        unread: AppColors.unreadDark,
      ),
    ],
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.darkCard,
      contentTextStyle: const TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.w600,
      ),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      elevation: 8,
    ),
  );

  static InputDecoration inputDecoration(
    String label,
    IconData icon, {
    String? hint,
    BuildContext? context,
  }) {
    final isDark =
        context != null && Theme.of(context).brightness == Brightness.dark;
    final primaryColor = isDark ? AppColors.darkAccent : AppColors.primaryGreen;

    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Icon(icon, size: 20, color: primaryColor),
      ),
      filled: true,
      fillColor: isDark
          ? Colors.white.withValues(alpha: 0.05)
          : Colors.white,
      labelStyle: TextStyle(
        color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      hintStyle: TextStyle(
        color: isDark ? Colors.white24 : Colors.grey.shade400,
        fontSize: 14,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        borderSide: BorderSide(
          color: isDark ? Colors.white10 : Colors.grey.shade200,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        borderSide: BorderSide(
          color: isDark ? Colors.white10 : Colors.grey.shade200,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        borderSide: BorderSide(color: primaryColor, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
    );
  }

  static ButtonStyle primaryButton(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ElevatedButton.styleFrom(
      backgroundColor: isDark ? AppColors.darkAccent : AppColors.primaryGreen,
      foregroundColor: isDark ? AppColors.darkBackground : Colors.white,
      minimumSize: const Size(double.infinity, AppSpacing.minTap + 20),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      textStyle: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
      elevation: 0,
    );
  }
}
