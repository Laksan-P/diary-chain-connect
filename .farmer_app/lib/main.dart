import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/preferences_provider.dart';
import 'services/profile_photo_service.dart';
import 'theme/design_tokens.dart';
import 'widgets/themed_app_logo.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/app_theme.dart';
import 'screens/splash_screen.dart';

import 'package:intl/date_symbol_data_local.dart';
import 'services/offline_service.dart';
import 'app_keys.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('en', null);
  await initializeDateFormatting('si', null);
  await initializeDateFormatting('ta', null);
  await OfflineService().init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => AppPreferences()),
        ChangeNotifierProvider(
          create: (_) {
            final s = ProfilePhotoService();
            s.init();
            return s;
          },
        ),
      ],
      child: const NestleDairyApp(),
    ),
  );
}

final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

class NestleDairyApp extends StatelessWidget {
  const NestleDairyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<AppPreferences>();

    return MaterialApp(
      title: 'Nestlé Dairy Connect',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      scaffoldMessengerKey: scaffoldMessengerKey,
      locale: prefs.locale,
      themeMode: prefs.themeMode,
      themeAnimationDuration: const Duration(milliseconds: 150),
      themeAnimationCurve: Curves.easeOut,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _showSplash = true;

  @override
  Widget build(BuildContext context) {
    if (_showSplash) {
      return SplashScreen(
        onComplete: () {
          setState(() => _showSplash = false);
        },
      );
    }

    final authProvider = context.watch<AuthProvider>();

    if (authProvider.isLoading) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return Scaffold(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.warmCream,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ThemedAppLogo(
                style: ThemedAppLogoStyle.compact,
                size: 72,
              ),
              const SizedBox(height: 28),
              const CircularProgressIndicator(color: AppTheme.primary),
            ],
          ),
        ),
      );
    }

    if (authProvider.isAuthenticated) {
      return const HomeScreen();
    }

    return const LoginScreen();
  }
}
