import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:provider/provider.dart';
import 'app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/preferences_provider.dart';
import '../services/translations.dart';
import '../services/toast_service.dart';

class ProfileScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const ProfileScreen({super.key, this.onBack});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = ApiService();
  final _formKey = GlobalKey<FormState>();
  bool _isEditing = false;
  bool _isLoading = false;
  Timer? _debounce;

  late TextEditingController _nameController;
  late TextEditingController _addressController;
  late TextEditingController _phoneController;
  late TextEditingController _nicController;
  late TextEditingController _bankNameController;
  late TextEditingController _accountNumberController;
  late TextEditingController _branchController;

  @override
  void initState() {
    super.initState();
    _initControllers();
    _fetchFarmerDetails();
  }

  Future<void> _fetchFarmerDetails() async {
    setState(() => _isLoading = true);
    try {
      final auth = context.read<AuthProvider>();
      final farmerId = auth.user?['farmerId'];
      if (farmerId == null) return;

      // 1) Fetch profile details
      final data = await _api.get('/farmers?action=get&id=$farmerId');
      debugPrint("PROFILE DATA: $data");

      if (mounted) {
        setState(() {
          _nameController.text = data['name']?.toString() ?? '';
          _nicController.text = data['nic']?.toString() ?? '';
          _addressController.text = data['address']?.toString() ?? '';
          _phoneController.text = data['phone']?.toString() ?? '';
        });
      }

      // 2) Fetch bank details using the dedicated bank-account endpoint
      try {
        final bankData = await _api.get('/farmers?action=bank-account&id=$farmerId');
        debugPrint("BANK DATA: $bankData");

        if (mounted && bankData != null) {
          setState(() {
            _bankNameController.text = (bankData['bankName'] ?? bankData['bank_name'] ?? '').toString();
            _accountNumberController.text = (bankData['accountNumber'] ?? bankData['account_number'] ?? '').toString();
            _branchController.text = (bankData['branch'] ?? '').toString();
          });
        }
      } catch (bankErr) {
        debugPrint("BANK FETCH ERROR: $bankErr");
        // Bank details may not exist yet — that's okay
      }
    } catch (e) {
      if (mounted) ToastService.show(context, e.toString(), isError: true);
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
    _accountNumberController = TextEditingController(
      text: user['accountNumber'] ?? '',
    );
    _branchController = TextEditingController(text: user['branch'] ?? '');
  }

  @override
  void dispose() {
    _debounce?.cancel();
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
      if (!silent) {
        ToastService.show(
          context,
          'Please correct the validation errors',
          isError: true,
        );
      }
      return;
    }

    if (!silent) setState(() => _isLoading = true);
    try {
      final auth = context.read<AuthProvider>();
      final farmerId = auth.user?['farmerId'];

      await _api.patch('/farmers?action=update&id=$farmerId', {
        'name': _nameController.text.trim(),
        'address': _addressController.text.trim(),
        'phone': _phoneController.text.trim(),
        'nic': _nicController.text.trim(),
        'bank_name': _bankNameController.text.trim(),
        'account_number': _accountNumberController.text.trim(),
        'branch': _branchController.text.trim(),
      });

      // Update local user data directly without triggering full app reload
      if (auth.user != null) {
        auth.user!['name'] = _nameController.text.trim();
        auth.user!['address'] = _addressController.text.trim();
        auth.user!['phone'] = _phoneController.text.trim();
        auth.user!['nic'] = _nicController.text.trim();
        auth.user!['bankName'] = _bankNameController.text.trim();
        auth.user!['accountNumber'] = _accountNumberController.text.trim();
        auth.user!['branch'] = _branchController.text.trim();
      }

      if (mounted && !silent) {
        ToastService.show(context, 'Profile updated successfully');
        setState(() => _isEditing = false);
      }
    } catch (e) {
      // Always show duplicate errors, even during silent saves
      if (mounted) {
        final errorMsg = e.toString();
        if (errorMsg.contains('NIC already') || errorMsg.contains('Phone number already') || !silent) {
          ToastService.show(context, errorMsg.replaceAll('Exception: ', ''), isError: true);
        }
      }
    } finally {
      if (mounted && !silent) setState(() => _isLoading = false);
    }
  }

  void _onFieldChanged() {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 1500), () {
      if (_isEditing && _formKey.currentState!.validate()) {
        _updateProfile(silent: true);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final prefs = context.watch<AppPreferences>();
    final locale = prefs.locale.languageCode;

    // Safety guard: If user is logging out, don't render Profile UI
    if (user == null) return const Scaffold(body: SizedBox.shrink());

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 60, 24, 120),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildProfileHeader(user, locale),
              const SizedBox(height: 48),

              if (_isEditing) ...[
                _sectionTitle(Translations.get('edit_profile', locale)),
                const SizedBox(height: 24),
                _field(
                  _nameController,
                  Translations.get('full_name', locale),
                  LucideIcons.user,
                ),
                const SizedBox(height: 16),
                _field(
                  _nicController,
                  Translations.get('nic', locale),
                  LucideIcons.creditCard,
                ),
                const SizedBox(height: 16),
                _field(
                  _addressController,
                  Translations.get('address', locale),
                  LucideIcons.mapPin,
                ),
                const SizedBox(height: 16),
                _field(
                  _phoneController,
                  Translations.get('phone', locale),
                  LucideIcons.phone,
                ),
                const SizedBox(height: 32),
                _sectionTitle(Translations.get('bank_details', locale)),
                const SizedBox(height: 24),
                _optionalField(
                  _bankNameController,
                  Translations.get('bank_name', locale),
                  LucideIcons.landmark,
                ),
                const SizedBox(height: 16),
                _optionalField(
                  _accountNumberController,
                  Translations.get('account_number', locale),
                  LucideIcons.hash,
                ),
                const SizedBox(height: 16),
                _optionalField(
                  _branchController,
                  Translations.get('branch', locale),
                  LucideIcons.gitBranch,
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: _isLoading ? null : _updateProfile,
                  style: AppTheme.primaryButton(context),
                  child: _isLoading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(Translations.get('update_profile', locale)),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => setState(() => _isEditing = false),
                  child: Text(
                    Translations.get('cancel', locale),
                    style: TextStyle(
                      color: Colors.grey.shade500,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ] else ...[
                _sectionTitle(Translations.get('settings', locale)),
                const SizedBox(height: 16),
                _settingsTile(
                  Translations.get('edit_profile', locale),
                  'Update your name, address and contact info',
                  LucideIcons.userCog,
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    _fetchFarmerDetails(); 
                    setState(() => _isEditing = true);
                  },
                ),
                _settingsTile(
                  Translations.get('language', locale),
                  locale == 'en'
                      ? 'English'
                      : locale == 'si'
                      ? 'සිංහල'
                      : 'தமிழ்',
                  LucideIcons.languages,
                  onTap: () => _showLanguagePicker(context, prefs),
                ),
                _settingsTile(
                  Translations.get('theme_mode', locale),
                  prefs.themeMode == ThemeMode.system
                      ? 'System'
                      : prefs.themeMode == ThemeMode.dark
                      ? 'Dark'
                      : 'Light',
                  prefs.themeMode == ThemeMode.dark
                      ? LucideIcons.moon
                      : LucideIcons.sun,
                  onTap: () => _showThemePicker(context, prefs),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => context.read<AuthProvider>().logout(),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.red,
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),
                  child: Text(
                    Translations.get('logout', locale),
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileHeader(dynamic user, String locale) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: Row(
            children: [
              GestureDetector(
                onTap: () {
                  if (_isEditing) {
                    setState(() => _isEditing = false);
                  } else {
                    widget.onBack?.call();
                  }
                },
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: (isDark ? Colors.white10 : Colors.grey.shade100),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    LucideIcons.chevronLeft,
                    size: 20,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  _isEditing
                      ? Translations.get('edit_profile', locale)
                      : Translations.get('profile', locale),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -1,
                  ),
                ),
              ),
              const SizedBox(width: 44),
            ],
          ),
        ),
        if (!_isEditing) ...[
          const SizedBox(height: 32),
          Column(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppTheme.primary.withValues(alpha: 0.1),
                    width: 1.5,
                  ),
                ),
                child: CircleAvatar(
                  radius: 54,
                  backgroundColor:
                      (isDark ? AppTheme.primaryLight : AppTheme.primary)
                          .withValues(alpha: 0.05),
                  child: Icon(
                    LucideIcons.user,
                    size: 48,
                    color: isDark ? AppTheme.primaryLight : AppTheme.primary,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                user['name'] ?? 'Farmer Name',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                user['farmerCode'] ?? 'ID: ...',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey.shade400,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _settingsTile(
    String title,
    String subtitle,
    IconData icon, {
    VoidCallback? onTap,
    Widget? trailing,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? AppTheme.surfaceDark
            : Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: AppTheme.premiumShadow,
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? Colors.white10
              : Colors.grey.shade50,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            HapticFeedback.selectionClick();
            onTap?.call();
          },
          borderRadius: BorderRadius.circular(28),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color:
                        (Theme.of(context).brightness == Brightness.dark
                                ? AppTheme.primaryLight
                                : AppTheme.primary)
                            .withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    icon,
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppTheme.primaryLight
                        : AppTheme.primary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          letterSpacing: -0.3,
                        ),
                      ),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: TextStyle(
                            color: Colors.grey.shade400,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                trailing ??
                    Icon(
                      LucideIcons.chevronRight,
                      size: 20,
                      color: Colors.grey.shade300,
                    ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showThemePicker(BuildContext context, AppPreferences prefs) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Theme Mode',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 24),
              _themeOption(
                'System Default',
                ThemeMode.system,
                LucideIcons.smartphone,
                prefs,
              ),
              _themeOption(
                'Light Mode',
                ThemeMode.light,
                LucideIcons.sun,
                prefs,
              ),
              _themeOption(
                'Dark Mode',
                ThemeMode.dark,
                LucideIcons.moon,
                prefs,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _themeOption(
    String label,
    ThemeMode mode,
    IconData icon,
    AppPreferences prefs,
  ) {
    bool isSelected = prefs.themeMode == mode;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isSelected
            ? (isDark ? AppTheme.primaryLight : AppTheme.primary).withValues(
                alpha: 0.1,
              )
            : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
      ),
      child: ListTile(
        leading: Icon(
          icon,
          color: isSelected
              ? (isDark ? AppTheme.primaryLight : AppTheme.primary)
              : Colors.grey,
        ),
        title: Text(
          label,
          style: TextStyle(
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        trailing: isSelected
            ? Icon(
                LucideIcons.check,
                color: isDark ? AppTheme.primaryLight : AppTheme.primary,
              )
            : null,
        onTap: () {
          HapticFeedback.lightImpact();
          prefs.setThemeMode(mode);
          Navigator.pop(context);
        },
      ),
    );
  }

  void _showLanguagePicker(BuildContext context, AppPreferences prefs) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                Translations.get('language', prefs.locale.languageCode),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 24),
              _langOption('English', 'en', prefs),
              _langOption('සිංහල', 'si', prefs),
              _langOption('தமிழ்', 'ta', prefs),
            ],
          ),
        ),
      ),
    );
  }

  Widget _langOption(String label, String code, AppPreferences prefs) {
    bool isSelected = prefs.locale.languageCode == code;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isSelected
            ? (Theme.of(context).brightness == Brightness.dark
                      ? AppTheme.primaryLight
                      : AppTheme.primary)
                  .withValues(alpha: 0.05)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
      ),
      child: ListTile(
        title: Text(
          label,
          style: TextStyle(
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        trailing: isSelected
            ? Icon(
                LucideIcons.check,
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.primaryLight
                    : AppTheme.primary,
              )
            : null,
        onTap: () {
          HapticFeedback.lightImpact();
          prefs.setLocale(code);
          Navigator.pop(context);
        },
      ),
    );
  }

  Widget _field(TextEditingController controller, String label, IconData icon) {
    final prefs = Provider.of<AppPreferences>(context, listen: false);
    final locale = prefs.locale.languageCode;

    int? maxLength;
    List<TextInputFormatter>? formatters;
    TextInputType keyboardType = TextInputType.text;

    if (icon == LucideIcons.phone) {
      maxLength = 10;
      formatters = [FilteringTextInputFormatter.digitsOnly];
      keyboardType = TextInputType.phone;
    } else if (icon == LucideIcons.creditCard) {
      maxLength = 12;
      formatters = [FilteringTextInputFormatter.allow(RegExp(r'[0-9vVxX]'))];
    }

    return TextFormField(
      controller: controller,
      onChanged: (_) => _onFieldChanged(),
      decoration: AppTheme.inputDecoration(label, icon, context: context).copyWith(
        counterText: '',
      ),
      maxLength: maxLength,
      inputFormatters: formatters,
      keyboardType: keyboardType,
      validator: (v) {
        if (v == null || v.isEmpty) {
          return Translations.get('required_field', locale);
        }
        if (icon == LucideIcons.phone) {
          if (v.length != 10) return 'Phone must be 10 digits';
          if (!RegExp(r'^[0-9]{10}$').hasMatch(v)) return 'Invalid phone number';
        }
        if (icon == LucideIcons.creditCard && !RegExp(r'^([0-9]{9}[vVxX]|[0-9]{12})$').hasMatch(v)) {
          return 'Invalid NIC (e.g. 123456789V or 12-digit)';
        }
        return null;
      },
    );
  }

  Widget _optionalField(TextEditingController controller, String label, IconData icon) {
    return TextFormField(
      controller: controller,
      onChanged: (_) => _onFieldChanged(),
      decoration: AppTheme.inputDecoration(label, icon, context: context),
    );
  }


  Widget _sectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w900,
        color: Colors.grey,
        letterSpacing: 1,
      ),
    );
  }
}
