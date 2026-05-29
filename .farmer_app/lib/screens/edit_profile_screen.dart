import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/preferences_provider.dart';
import '../services/farmer_profile_service.dart';
import '../services/offline_service.dart';
import '../services/toast_service.dart';
import '../services/translations.dart';
import '../widgets/animated_button.dart';
import '../widgets/farmer/farmer_scenic_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/offline_banner.dart';
import '../widgets/profile_avatar.dart';
import 'app_theme.dart';

class EditProfileScreen extends StatefulWidget {
  final String? weatherCondition;

  const EditProfileScreen({super.key, this.weatherCondition});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _service = FarmerProfileService();
  late TextEditingController _nameController;
  late TextEditingController _nicController;
  late TextEditingController _addressController;
  late TextEditingController _phoneController;
  Map<String, String> _bankSnapshot = {};
  bool _loading = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user ?? {};
    _nameController = TextEditingController(text: user['name']?.toString() ?? '');
    _nicController = TextEditingController(text: user['nic']?.toString() ?? '');
    _addressController = TextEditingController(text: user['address']?.toString() ?? '');
    _phoneController = TextEditingController(text: user['phone']?.toString() ?? '');
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = context.read<AuthProvider>();
      final data = await _service.fetchDetails(auth);
      if (!mounted) return;
      setState(() {
        _nameController.text = data['name']?.toString() ?? '';
        _nicController.text = data['nic']?.toString() ?? '';
        _addressController.text = data['address']?.toString() ?? '';
        _phoneController.text = data['phone']?.toString() ?? '';
        _bankSnapshot = {
          'bank_name': (data['bankName'] ?? data['bank_name'] ?? '').toString(),
          'account_number': (data['accountNumber'] ?? data['account_number'] ?? '').toString(),
          'branch': (data['branch'] ?? '').toString(),
        };
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final locale = context.read<AppPreferences>().locale.languageCode;
    try {
      await _service.updateProfile(
        auth: context.read<AuthProvider>(),
        personal: {
          'name': _nameController.text.trim(),
          'nic': _nicController.text.trim(),
          'address': _addressController.text.trim(),
          'phone': _phoneController.text.trim(),
        },
        bank: _bankSnapshot,
      );
      if (!mounted) return;
      ToastService.show(
        context,
        OfflineService().isOnline
            ? Translations.get('profile_updated_success', locale)
            : Translations.get('offline_saved_msg', locale),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ToastService.show(context, e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _nicController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.watch<AppPreferences>().locale.languageCode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Stack(
        children: [
          FarmerScenicBackground(
            height: 220,
            weatherCondition: widget.weatherCondition,
          ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: Icon(Icons.arrow_back_ios_new_rounded,
                            color: isDark ? Colors.white : Colors.black87, size: 18),
                      ),
                      Expanded(
                        child: Text(
                          Translations.get('edit_profile', locale),
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                ),
                OfflineBanner(locale: locale),
                Expanded(
                  child: _loading
                      ? const Center(child: CircularProgressIndicator())
                      : SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                          child: Form(
                            key: _formKey,
                            child: Column(
                              children: [
                                Center(
                                  child: ProfileAvatar(
                                    radius: 56,
                                    locale: locale,
                                    editable: true,
                                    onChanged: () => setState(() {}),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  Translations.get('add_profile_photo', locale),
                                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                                ),
                                const SizedBox(height: 24),
                                GlassCard(
                                  child: Column(
                                    children: [
                                      _field(_nameController, Translations.get('full_name', locale),
                                          LucideIcons.user, locale),
                                      const SizedBox(height: 14),
                                      _field(_nicController, Translations.get('nic', locale),
                                          LucideIcons.creditCard, locale),
                                      const SizedBox(height: 14),
                                      _field(_addressController, Translations.get('address', locale),
                                          LucideIcons.mapPin, locale),
                                      const SizedBox(height: 14),
                                      _field(_phoneController, Translations.get('phone', locale),
                                          LucideIcons.phone, locale),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 24),
                                AnimatedButton(
                                  label: Translations.get('update_profile', locale),
                                  loading: _saving,
                                  onPressed: _save,
                                  icon: LucideIcons.save,
                                ),
                              ],
                            ),
                          ),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController c, String label, IconData icon, String locale) {
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
    }
    return TextFormField(
      controller: c,
      decoration: AppTheme.inputDecoration(label, icon, context: context).copyWith(counterText: ''),
      maxLength: maxLength,
      inputFormatters: formatters,
      keyboardType: keyboardType,
      validator: (v) {
        if (v == null || v.isEmpty) return Translations.get('required_field', locale);
        if (icon == LucideIcons.phone) {
          if (v.length != 10) return Translations.get('phone_10_digits', locale);
          if (!RegExp(r'^[0-9]{10}$').hasMatch(v)) {
            return Translations.get('invalid_phone', locale);
          }
        }
        if (icon == LucideIcons.creditCard &&
            !RegExp(r'^([0-9]{9}[vVxX]|[0-9]{12})$').hasMatch(v)) {
          return Translations.get('invalid_nic', locale);
        }
        return null;
      },
    );
  }
}
