import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../widgets/offline_banner.dart';
import 'app_theme.dart';
import '../services/api_service.dart';
import '../providers/auth_provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/preferences_provider.dart';
import '../services/translations.dart';
import '../services/toast_service.dart';
import '../services/offline_service.dart';
import '../widgets/bouncing_button.dart';
import 'faq_screen.dart';

class ProfileScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final bool hasUnreadSupport;
  const ProfileScreen({super.key, this.onBack, this.hasUnreadSupport = false});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = ApiService();
  final _formKey = GlobalKey<FormState>();
  
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _addressController;
  late TextEditingController _phoneController;
  late TextEditingController _nicController;
  late TextEditingController _bankNameController;
  late TextEditingController _accountNumberController;
  late TextEditingController _branchController;

  bool _isEditing = false;
  bool _isLoading = false;
  bool _hasUnreadSupport = false;
  String? _selectedBank;
  Timer? _supportCheckTimer;

  final Map<String, int> _bankRules = {
    'Bank of Ceylon': 12,
    'People\'s Bank': 15,
    'Commercial Bank': 10,
    'Hatton National Bank': 12,
    'Sampath Bank': 12,
    'Seylan Bank': 15,
    'Nations Trust Bank': 15,
    'DFCC Bank': 12,
    'NDB Bank': 12,
    'Pan Asia Bank': 12,
    'Union Bank': 12,
    'Amana Bank': 12,
    'Cargills Bank': 12,
  };

  @override
  void initState() {
    super.initState();
    _hasUnreadSupport = widget.hasUnreadSupport;
    _initControllers();
    _fetchFarmerDetails();
    _checkSupportUnread();
    _supportCheckTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      if (mounted && !_isEditing) _checkSupportUnread();
    });
  }

  Future<void> _checkSupportUnread() async {
    try {
      final tickets = await _api.get('/support');
      if (mounted && tickets is List) {
        final unread = tickets.any((t) => t['is_read_by_user'] == false);
        if (unread != _hasUnreadSupport) {
          setState(() => _hasUnreadSupport = unread);
        }
      }
    } catch (e) {
      debugPrint("Support unread check error: $e");
    }
  }

  Future<void> _fetchFarmerDetails() async {
    final auth = context.read<AuthProvider>();
    if (auth.user == null) return;

    setState(() => _isLoading = true);
    try {
      if (!OfflineService().isOnline) {
        throw Exception('Offline');
      }

      final res = await _api.get('/farmers?action=get&id=${auth.user!['farmerId']}');
      if (mounted) {
        setState(() {
          _nameController.text = res['name']?.toString() ?? '';
          _nicController.text = res['nic']?.toString() ?? '';
          _addressController.text = res['address']?.toString() ?? '';
          _phoneController.text = res['phone']?.toString() ?? '';
        });

        // Fetch bank details separately
        try {
          final bankRes = await _api.get('/farmers?action=bank-details&id=${auth.user!['farmerId']}');
          if (mounted && bankRes != null) {
            final bankData = bankRes is List ? bankRes.first : bankRes;
            setState(() {
              _bankNameController.text = (bankData['bankName'] ?? bankData['bank_name'] ?? '').toString();
              _selectedBank = _bankRules.containsKey(_bankNameController.text) ? _bankNameController.text : (_bankNameController.text.isNotEmpty ? 'Other' : null);
              _accountNumberController.text = (bankData['accountNumber'] ?? bankData['account_number'] ?? '').toString();
              _branchController.text = (bankData['branch'] ?? '').toString();
            });
          }
        } catch (bankErr) {
          debugPrint("BANK FETCH ERROR: $bankErr");
        }
      }
    } catch (e) {
      debugPrint("Farmer details fetch failed: $e");
      // Fallback to cached auth user data if API fails
      if (mounted && auth.user != null) {
        setState(() {
          _nameController.text = auth.user!['name']?.toString() ?? '';
          _nicController.text = auth.user!['nic']?.toString() ?? '';
          _addressController.text = auth.user!['address']?.toString() ?? '';
          _phoneController.text = auth.user!['phone']?.toString() ?? '';
          _bankNameController.text = (auth.user!['bankName'] ?? '').toString();
          _selectedBank = _bankRules.containsKey(_bankNameController.text) ? _bankNameController.text : (_bankNameController.text.isNotEmpty ? 'Other' : null);
          _accountNumberController.text = (auth.user!['accountNumber'] ?? '').toString();
          _branchController.text = (auth.user!['branch'] ?? '').toString();
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _initControllers() {
    final user = context.read<AuthProvider>().user ?? {};
    _nameController = TextEditingController(text: user['name'] ?? '');
    _addressController = TextEditingController(text: user['address'] ?? '');
    _phoneController = TextEditingController(text: user['phone'] ?? '');
    _nicController = TextEditingController(text: user['nic'] ?? '');
    _bankNameController = TextEditingController(text: user['bankName'] ?? '');
    _selectedBank = _bankRules.containsKey(_bankNameController.text) ? _bankNameController.text : (_bankNameController.text.isNotEmpty ? 'Other' : null);
    _accountNumberController = TextEditingController(text: user['accountNumber'] ?? '');
    _branchController = TextEditingController(text: user['branch'] ?? '');
  }

  @override
  void dispose() {
    _supportCheckTimer?.cancel();
    _nameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _nicController.dispose();
    _bankNameController.dispose();
    _accountNumberController.dispose();
    _branchController.dispose();
    super.dispose();
  }

  Future<void> _updateProfile({bool silent = false}) async {
    if (!silent) HapticFeedback.mediumImpact();
    if (!_formKey.currentState!.validate()) {
      if (!silent) ToastService.show(context, 'Please correct the validation errors', isError: true);
      return;
    }

    final auth = context.read<AuthProvider>();
    final farmerId = auth.user?['farmerId'];
    final updateData = {
      'name': _nameController.text.trim(),
      'address': _addressController.text.trim(),
      'phone': _phoneController.text.trim(),
      'nic': _nicController.text.trim(),
      'bank_name': _bankNameController.text.trim(),
      'account_number': _accountNumberController.text.trim(),
      'branch': _branchController.text.trim(),
    };

    if (!OfflineService().isOnline) {
      await OfflineService().addPendingAction(
        '/farmers?action=update&id=$farmerId',
        'PATCH',
        updateData,
      );
      
      // Optimistic update of local user state
      auth.updateLocalUser({
        'name': _nameController.text.trim(),
        'address': _addressController.text.trim(),
        'phone': _phoneController.text.trim(),
        'nic': _nicController.text.trim(),
        'bankName': _bankNameController.text.trim(),
        'accountNumber': _accountNumberController.text.trim(),
        'branch': _branchController.text.trim(),
      });

      if (mounted) {
        ToastService.show(context, 'Changes saved locally! Will sync when online.');
        setState(() => _isEditing = false);
      }
      return;
    }

    setState(() => _isLoading = true);
    try {
      await _api.patch('/farmers?action=update&id=$farmerId', updateData);
      await auth.checkAuth();
      if (mounted) {
        ToastService.show(context, 'Profile updated successfully!');
        setState(() => _isEditing = false);
      }
    } catch (e) {
      if (mounted) ToastService.show(context, e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final prefs = context.watch<AppPreferences>();
    final locale = prefs.locale.languageCode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (user == null) return const Scaffold(body: SizedBox.shrink());

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Stack(
          children: [
            // Subtle background decoration
            Positioned(
              top: -100,
              right: -100,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  color: isDark 
                      ? Colors.white.withValues(alpha: 0.05)
                      : AppTheme.primary.withValues(alpha: 0.03),
                  shape: BoxShape.circle,
                ),
              ),
            ),
            SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 120),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    OfflineBanner(locale: locale),
                    _buildScrollableHeader(locale, isDark),
                    if (!_isEditing) ...[
                      const SizedBox(height: 32),
                      _buildAvatarHeader(user, isDark),
                    ],
                    const SizedBox(height: 48),

                    if (_isEditing) ...[
                      _sectionTitle(Translations.get('edit_profile', locale)),
                      const SizedBox(height: 24),
                      _field(_nameController, Translations.get('full_name', locale), LucideIcons.user, locale),
                      const SizedBox(height: 16),
                      _field(_nicController, Translations.get('nic', locale), LucideIcons.creditCard, locale),
                      const SizedBox(height: 16),
                      _field(_addressController, Translations.get('address', locale), LucideIcons.mapPin, locale),
                      const SizedBox(height: 16),
                      _field(_phoneController, Translations.get('phone', locale), LucideIcons.phone, locale),
                      const SizedBox(height: 32),
                      _sectionTitle(Translations.get('bank_details', locale)),
                      const SizedBox(height: 24),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: DropdownButtonFormField<String>(
                          value: _selectedBank,
                          decoration: AppTheme.inputDecoration(Translations.get('bank_name', locale), LucideIcons.landmark, context: context),
                          items: [..._bankRules.keys, 'Other'].map((bank) => DropdownMenuItem(value: bank, child: Text(bank))).toList(),
                          onChanged: (v) {
                            setState(() {
                              _selectedBank = v;
                              _bankNameController.text = v ?? '';
                              _accountNumberController.clear();
                            });
                          },
                          validator: (v) => v == null ? Translations.get('required_field', locale) : null,
                        ),
                      ),
                      _field(_accountNumberController, Translations.get('account_number', locale), LucideIcons.hash, locale),
                      const SizedBox(height: 16),
                      _optionalField(_branchController, Translations.get('branch', locale), LucideIcons.gitBranch),
                      const SizedBox(height: 32),
                      ElevatedButton(
                        onPressed: _isLoading ? null : _updateProfile,
                        style: AppTheme.primaryButton(context),
                        child: _isLoading
                            ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : Text(Translations.get('update_profile', locale)),
                      ),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          _initControllers();
                          setState(() => _isEditing = false);
                        },
                        child: Text(Translations.get('cancel', locale), style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.bold)),
                      ),
                    ] else ...[
                      _sectionTitle(Translations.get('settings', locale)),
                      const SizedBox(height: 16),
                      _settingsTile(
                        Translations.get('edit_profile', locale),
                        Translations.get('profile_edit_subtitle', locale),
                        LucideIcons.userCog,
                        onTap: () {
                          HapticFeedback.mediumImpact();
                          _fetchFarmerDetails(); 
                          setState(() => _isEditing = true);
                        },
                      ),
                      _settingsTile(
                        Translations.get('language', locale),
                        locale == 'en' ? 'English' : locale == 'si' ? 'සිංහල' : 'தமிழ்',
                        LucideIcons.languages,
                        onTap: () => _showLanguagePicker(context, prefs),
                      ),
                      _settingsTile(
                        Translations.get('theme_mode', locale),
                        prefs.themeMode == ThemeMode.system ? Translations.get('system', locale) : prefs.themeMode == ThemeMode.dark ? Translations.get('dark', locale) : Translations.get('light', locale),
                        prefs.themeMode == ThemeMode.dark ? LucideIcons.moon : LucideIcons.sun,
                        onTap: () => _showThemePicker(context, prefs),
                      ),
                      _settingsTile(
                        Translations.get('faq_support', locale),
                        Translations.get('faq_support_desc', locale),
                        LucideIcons.helpCircle,
                        trailing: _hasUnreadSupport ? _buildUnreadDot() : null,
                        onTap: () async {
                          HapticFeedback.selectionClick();
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => FaqScreen(onBack: () => Navigator.pop(context)),
                            ),
                          );
                          // Re-check after returning
                          _checkSupportUnread();
                        },
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => context.read<AuthProvider>().logout(),
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.red,
                          padding: const EdgeInsets.symmetric(vertical: 20),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                        ),
                        child: Text(Translations.get('logout', locale), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: 0.5)),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScrollableHeader(String locale, bool isDark) {
    return Container(
      padding: const EdgeInsets.only(top: 45, bottom: 12),
      child: Row(
        children: [
          _buildCircleBackButton(isDark),
          Expanded(
            child: Text(
              _isEditing ? Translations.get('edit_profile', locale) : Translations.get('profile', locale),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w900,
                fontSize: 24,
                letterSpacing: -0.5,
              ),
            ),
          ),
          const SizedBox(width: 48), // Spacer to balance the back button
        ],
      ),
    );
  }

  Widget _buildCircleBackButton(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade100,
        shape: BoxShape.circle,
      ),
      child: IconButton(
        icon: Icon(
          Icons.arrow_back_ios_new_rounded,
          color: isDark ? Colors.white : Colors.black87,
          size: 14,
        ),
        onPressed: () {
          HapticFeedback.lightImpact();
          if (_isEditing) {
            _initControllers();
            setState(() => _isEditing = false);
          } else {
            widget.onBack?.call();
          }
        },
      ),
    );
  }

  Widget _buildAvatarHeader(dynamic user, bool isDark) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.primary.withValues(alpha: 0.1), width: 1.5),
          ),
          child: CircleAvatar(
            radius: 54,
            backgroundColor: (isDark ? AppTheme.primaryLight : AppTheme.primary).withValues(alpha: 0.05),
            child: Icon(LucideIcons.user, size: 48, color: isDark ? AppTheme.primaryLight : AppTheme.primary),
          ),
        ),
        const SizedBox(height: 24),
        Text(
          user['name'] ?? 'Farmer Name',
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: -0.5),
        ),
        const SizedBox(height: 4),
        Text(
          user['farmerCode'] ?? 'ID: ...',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey.shade400),
        ),
      ],
    );
  }

  Widget _buildUnreadDot() {
    return Container(
      width: 10,
      height: 10,
      decoration: const BoxDecoration(
        color: Colors.redAccent,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.redAccent,
            blurRadius: 8,
            spreadRadius: 1,
          )
        ],
      ),
    );
  }

  Widget _settingsTile(String title, String subtitle, IconData icon, {VoidCallback? onTap, Widget? trailing}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: AppTheme.premiumShadow,
        border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade50),
      ),
      child: BouncingButton(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap?.call();
        },
        child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: (isDark ? AppTheme.primaryLight : AppTheme.primary).withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: isDark ? AppTheme.primaryLight : AppTheme.primary, size: 22),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          if (trailing != null) ...[
                            const SizedBox(width: 8),
                            trailing,
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
                Icon(LucideIcons.chevronRight, size: 16, color: Colors.grey.shade300),
              ],
            ),
        ),
      ),
    );
  }

  void _showLanguagePicker(BuildContext context, AppPreferences prefs) {
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
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Select Language', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            _langOption('en', 'English', prefs),
            _langOption('si', 'සිංහල', prefs),
            _langOption('ta', 'தமிழ்', prefs),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _langOption(String code, String label, AppPreferences prefs) {
    bool isSelected = prefs.locale.languageCode == code;
    return BouncingButton(
      onTap: () {
        HapticFeedback.selectionClick();
        prefs.setLocale(code);
        Navigator.pop(context);
      },
      child: ListTile(
        title: Text(label, style: TextStyle(fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
        trailing: isSelected ? const Icon(LucideIcons.check, color: AppTheme.primary) : null,
      ),
    );
  }

  void _showThemePicker(BuildContext context, AppPreferences prefs) {
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
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Theme Mode', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            _themeOption(ThemeMode.light, 'Light Mode', LucideIcons.sun, prefs),
            _themeOption(ThemeMode.dark, 'Dark Mode', LucideIcons.moon, prefs),
            _themeOption(ThemeMode.system, 'System Default', LucideIcons.monitor, prefs),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _themeOption(ThemeMode mode, String label, IconData icon, AppPreferences prefs) {
    bool isSelected = prefs.themeMode == mode;
    return BouncingButton(
      onTap: () {
        HapticFeedback.selectionClick();
        prefs.setThemeMode(mode);
        Navigator.pop(context);
      },
      child: ListTile(
        leading: Icon(icon),
        title: Text(label, style: TextStyle(fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
        trailing: isSelected ? const Icon(LucideIcons.check, color: AppTheme.primary) : null,
      ),
    );
  }

  Widget _field(TextEditingController controller, String label, IconData icon, String locale) {
    int? maxLength;
    List<TextInputFormatter>? formatters;
    TextInputType? keyboardType;

    if (icon == LucideIcons.phone) {
      maxLength = 10;
      formatters = [FilteringTextInputFormatter.digitsOnly];
      keyboardType = TextInputType.phone;
    } else if (icon == LucideIcons.creditCard) {
      maxLength = 12;
      formatters = [FilteringTextInputFormatter.allow(RegExp(r'[0-9vVxX]'))];
    } else if (icon == LucideIcons.hash) {
      if (_selectedBank != null && _selectedBank != 'Other') {
        maxLength = _bankRules[_selectedBank];
      }
      formatters = [FilteringTextInputFormatter.digitsOnly];
      keyboardType = TextInputType.number;
    }

    return TextFormField(
      controller: controller,
      decoration: AppTheme.inputDecoration(label, icon, context: context).copyWith(counterText: ''),
      maxLength: maxLength,
      inputFormatters: formatters,
      keyboardType: keyboardType,
      validator: (v) {
        if (v == null || v.isEmpty) return Translations.get('required_field', locale);
        if (icon == LucideIcons.phone) {
          if (v.length != 10) {
            return Translations.get('phone_10_digits', locale);
          }
          if (!RegExp(r'^[0-9]{10}$').hasMatch(v)) {
            return Translations.get('invalid_phone', locale);
          }
        }
        if (icon == LucideIcons.creditCard && !RegExp(r'^([0-9]{9}[vVxX]|[0-9]{12})$').hasMatch(v)) {
          return Translations.get('invalid_nic', locale);
        }
        if (icon == LucideIcons.hash && _selectedBank != null && _selectedBank != 'Other') {
          final requiredLength = _bankRules[_selectedBank];
          if (v.length != requiredLength) return 'Must be $requiredLength digits';
        }
        return null;
      },
    );
  }

  Widget _optionalField(TextEditingController controller, String label, IconData icon) {
    return TextFormField(
      controller: controller,
      decoration: AppTheme.inputDecoration(label, icon, context: context),
    );
  }

  Widget _sectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 1),
    );
  }
}
