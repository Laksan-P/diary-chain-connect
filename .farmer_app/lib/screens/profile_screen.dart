import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'app_theme.dart';
import '../services/api_service.dart';
import '../providers/auth_provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/preferences_provider.dart';
import '../services/translations.dart';
import '../widgets/farmer/profile_menu_item.dart';
import '../services/hero_background_service.dart';
import '../widgets/farmer/farmer_scenic_background.dart';
import '../widgets/bouncing_button.dart';
import '../widgets/profile_avatar.dart';
import '../theme/design_tokens.dart';
import '../utils/chilling_center_resolver.dart';
import '../services/offline_service.dart';
import '../utils/page_transitions.dart';
import 'edit_profile_screen.dart';
import 'bank_details_screen.dart';
import 'faq_screen.dart';

class ProfileScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final bool hasUnreadSupport;
  final String? weatherCondition;
  const ProfileScreen({
    super.key,
    this.onBack,
    this.hasUnreadSupport = false,
    this.weatherCondition,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = ApiService();
  bool _hasUnreadSupport = false;
  Timer? _supportCheckTimer;

  @override
  void initState() {
    super.initState();
    _hasUnreadSupport = widget.hasUnreadSupport;
    _checkSupportUnread();
    _supportCheckTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) _checkSupportUnread();
    });
  }

  @override
  void dispose() {
    _supportCheckTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkSupportUnread() async {
    try {
      final tickets = await _api.get('/support');
      if (mounted && tickets is List) {
        final unread = tickets.any((t) => t['is_read_by_user'] == false);
        if (unread != _hasUnreadSupport) setState(() => _hasUnreadSupport = unread);
      }
    } catch (_) {}
  }

  void _openEditProfile() {
    HapticFeedback.mediumImpact();
    Navigator.of(context).push(
      premiumPageRoute(EditProfileScreen(weatherCondition: widget.weatherCondition)),
    );
  }

  void _openBankDetails() {
    HapticFeedback.mediumImpact();
    Navigator.of(context).push(premiumPageRoute(const BankDetailsScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final prefs = context.watch<AppPreferences>();
    final locale = prefs.locale.languageCode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (user == null) return const Scaffold(body: SizedBox.shrink());

    final topInset = MediaQuery.paddingOf(context).top;
    final heroHeight = HeroBackgroundService.profileHeroHeight + topInset;
    final contentBg = Theme.of(context).scaffoldBackgroundColor;

    return Scaffold(
      backgroundColor: contentBg,
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          FarmerScenicBackground(
            height: heroHeight,
            weatherCondition: widget.weatherCondition,
            headerReadable: true,
            fadeToColor: contentBg,
          ),
          SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      if (widget.onBack != null)
                        BouncingButton(
                          onTap: widget.onBack!,
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.22),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
                            ),
                            child: const Icon(
                              Icons.arrow_back_ios_new_rounded,
                              size: 16,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      Expanded(
                        child: Text(
                          Translations.get('profile', locale),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            shadows: [
                              Shadow(
                                color: Color(0x73000000),
                                blurRadius: 8,
                                offset: Offset(0, 2),
                              ),
                            ],
                          ),
                        ),
                      ),
                      SizedBox(width: widget.onBack != null ? 40 : 0),
                    ],
                  ),
                  SizedBox(height: heroHeight - 196),
                  Transform.translate(
                    offset: const Offset(0, 32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: ProfileAvatar(
                            radius: 58,
                            locale: locale,
                            editable: true,
                            onChanged: () => setState(() {}),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          user['name']?.toString() ?? '',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 8),
                        Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.nestleBlue.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(LucideIcons.badgeCheck, size: 14, color: AppColors.nestleBlue),
                                const SizedBox(width: 6),
                                Text(
                                  Translations.get('verified_farmer', locale),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.nestleBlue,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          user['farmerCode']?.toString() ?? '',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
                        ),
                        Builder(
                          builder: (context) {
                            final farmerId = user['farmerId']?.toString();
                            final cachedCollections =
                                OfflineService().getCachedData('collections');
                            final center = ChillingCenterResolver.resolve(
                              user: user,
                              collections: cachedCollections is List
                                  ? ChillingCenterResolver.collectionsForFarmer(
                                      List<dynamic>.from(cachedCollections),
                                      farmerId,
                                    )
                                  : const [],
                            );
                            if (center == null || center.isEmpty) return const SizedBox.shrink();
                            return Padding(
                              padding: const EdgeInsets.only(top: 10),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(LucideIcons.mapPin, size: 14, color: Colors.grey.shade500),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: Text(
                                      center,
                                      textAlign: TextAlign.center,
                                      maxLines: 2,
                                      overflow: TextOverflow.visible,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: isDark ? Colors.white60 : AppColors.deepForest.withValues(alpha: 0.7),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 28),
                        Text(
                          Translations.get('settings', locale).toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                            color: isDark ? Colors.white38 : Colors.black45,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ProfileMenuItem(
                          title: Translations.get('edit_profile', locale),
                          subtitle: Translations.get('profile_edit_subtitle', locale),
                          icon: LucideIcons.userCog,
                          onTap: _openEditProfile,
                        ),
                        ProfileMenuItem(
                          title: Translations.get('bank_details', locale),
                          subtitle: Translations.get('bank_info', locale),
                          icon: LucideIcons.landmark,
                          onTap: _openBankDetails,
                        ),
                        ProfileMenuItem(
                          title: Translations.get('language', locale),
                          subtitle: locale == 'en' ? 'English' : locale == 'si' ? 'සිංහල' : 'தமிழ்',
                          icon: LucideIcons.languages,
                          onTap: () => _showLanguagePicker(context, prefs),
                        ),
                        ProfileMenuItem(
                          title: Translations.get('theme_mode', locale),
                          subtitle: prefs.themeMode == ThemeMode.system
                              ? Translations.get('system_default', locale)
                              : prefs.themeMode == ThemeMode.dark
                              ? Translations.get('dark_mode', locale)
                              : Translations.get('light_mode', locale),
                          icon: prefs.themeMode == ThemeMode.dark ? LucideIcons.moon : LucideIcons.sun,
                          onTap: () => _showThemePicker(context, prefs, locale),
                        ),
                        ProfileMenuItem(
                          title: Translations.get('faq_support', locale),
                          subtitle: Translations.get('faq_support_desc', locale),
                          icon: LucideIcons.helpCircle,
                          trailing: _hasUnreadSupport ? _unreadDot() : null,
                          onTap: () async {
                            await Navigator.push(
                              context,
                              premiumPageRoute(FaqScreen(onBack: () => Navigator.pop(context))),
                            );
                            _checkSupportUnread();
                          },
                        ),
                        const SizedBox(height: 8),
                        ProfileMenuItem(
                          title: Translations.get('logout', locale),
                          icon: LucideIcons.logOut,
                          destructive: true,
                          onTap: () => context.read<AuthProvider>().logout(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _unreadDot() => Container(
        width: 10,
        height: 10,
        decoration: const BoxDecoration(color: Colors.redAccent, shape: BoxShape.circle),
      );

  void _showLanguagePicker(BuildContext context, AppPreferences prefs) {
    final locale = prefs.locale.languageCode;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(Translations.get('select_language', locale),
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            _langOption('en', 'English', prefs),
            _langOption('si', 'සිංහල', prefs),
            _langOption('ta', 'தமிழ்', prefs),
          ],
        ),
      ),
    );
  }

  Widget _langOption(String code, String label, AppPreferences prefs) {
    final selected = prefs.locale.languageCode == code;
    return BouncingButton(
      onTap: () {
        prefs.setLocale(code);
        Navigator.pop(context);
      },
      child: ListTile(
        title: Text(label, style: TextStyle(fontWeight: selected ? FontWeight.bold : null)),
        trailing: selected ? const Icon(LucideIcons.check, color: AppTheme.primary) : null,
      ),
    );
  }

  void _showThemePicker(BuildContext context, AppPreferences prefs, String locale) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(Translations.get('choose_theme', locale),
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            Row(
              children: [
                ThemeModeCard(
                  label: Translations.get('light_mode', locale),
                  icon: LucideIcons.sun,
                  selected: prefs.themeMode == ThemeMode.light,
                  onTap: () {
                    prefs.setThemeMode(ThemeMode.light);
                    Navigator.pop(context);
                  },
                ),
                const SizedBox(width: 10),
                ThemeModeCard(
                  label: Translations.get('dark_mode', locale),
                  icon: LucideIcons.moon,
                  selected: prefs.themeMode == ThemeMode.dark,
                  onTap: () {
                    prefs.setThemeMode(ThemeMode.dark);
                    Navigator.pop(context);
                  },
                ),
                const SizedBox(width: 10),
                ThemeModeCard(
                  label: Translations.get('system_default', locale),
                  icon: LucideIcons.monitor,
                  selected: prefs.themeMode == ThemeMode.system,
                  onTap: () {
                    prefs.setThemeMode(ThemeMode.system);
                    Navigator.pop(context);
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
