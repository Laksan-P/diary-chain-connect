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
import '../theme/design_tokens.dart';
import '../widgets/animated_button.dart';
import '../widgets/glass_card.dart';
import '../widgets/offline_banner.dart';
import 'app_theme.dart';

class BankDetailsScreen extends StatefulWidget {
  const BankDetailsScreen({super.key});

  @override
  State<BankDetailsScreen> createState() => _BankDetailsScreenState();
}

class _BankDetailsScreenState extends State<BankDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _service = FarmerProfileService();
  late TextEditingController _bankNameController;
  late TextEditingController _accountNumberController;
  late TextEditingController _branchController;
  Map<String, String> _personalSnapshot = {};
  String? _selectedBank;
  bool _loading = false;
  bool _saving = false;

  static const _bankRules = {
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
    final user = context.read<AuthProvider>().user ?? {};
    _bankNameController = TextEditingController(text: user['bankName']?.toString() ?? '');
    _accountNumberController = TextEditingController(text: user['accountNumber']?.toString() ?? '');
    _branchController = TextEditingController(text: user['branch']?.toString() ?? '');
    _syncSelectedBank();
    _load();
  }

  void _syncSelectedBank() {
    final bankText = _bankNameController.text.trim();
    _selectedBank = _bankRules.keys.firstWhere(
      (k) => k.toLowerCase() == bankText.toLowerCase(),
      orElse: () => bankText.isNotEmpty ? 'Other' : '',
    );
    if (_selectedBank!.isEmpty) _selectedBank = null;
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = context.read<AuthProvider>();
      final data = await _service.fetchDetails(auth);
      if (!mounted) return;
      setState(() {
        _personalSnapshot = {
          'name': data['name']?.toString() ?? '',
          'nic': data['nic']?.toString() ?? '',
          'address': data['address']?.toString() ?? '',
          'phone': data['phone']?.toString() ?? '',
        };
        _bankNameController.text = (data['bankName'] ?? data['bank_name'] ?? '').toString();
        _accountNumberController.text =
            (data['accountNumber'] ?? data['account_number'] ?? '').toString();
        _branchController.text = (data['branch'] ?? '').toString();
        _syncSelectedBank();
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
        personal: _personalSnapshot,
        bank: {
          'bank_name': _bankNameController.text.trim(),
          'account_number': _accountNumberController.text.trim(),
          'branch': _branchController.text.trim(),
        },
      );
      if (!mounted) return;
      ToastService.show(
        context,
        OfflineService().isOnline
            ? Translations.get('bank_updated_success', locale)
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
    _bankNameController.dispose();
    _accountNumberController.dispose();
    _branchController.dispose();
    super.dispose();
  }

  Widget _bankPreview(String locale) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final masked = _accountNumberController.text.isEmpty
        ? '•••• •••• ••••'
        : '•••• ${_accountNumberController.text.length > 4 ? _accountNumberController.text.substring(_accountNumberController.text.length - 4) : _accountNumberController.text}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? [const Color(0xFF12324F), AppColors.darkCard]
              : [AppColors.nestleBlue, AppColors.deepForest],
        ),
        borderRadius: BorderRadius.circular(AppRadii.xl),
        boxShadow: [
          BoxShadow(
            color: AppColors.nestleBlue.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(LucideIcons.landmark, color: Colors.white70, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _bankNameController.text.isEmpty
                      ? Translations.get('bank_name', locale)
                      : _bankNameController.text,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            masked,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _branchController.text.isEmpty
                ? Translations.get('branch', locale)
                : _branchController.text,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 12),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.watch<AppPreferences>().locale.languageCode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(Translations.get('bank_details', locale)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: isDark ? Colors.white : AppColors.deepForest,
      ),
      body: Column(
        children: [
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
                          _bankPreview(locale),
                          const SizedBox(height: 20),
                          GlassCard(
                            child: Column(
                              children: [
                                DropdownButtonFormField<String>(
                                  value: _selectedBank,
                                  decoration: AppTheme.inputDecoration(
                                    Translations.get('bank_name', locale),
                                    LucideIcons.landmark,
                                    context: context,
                                  ),
                                  items: [..._bankRules.keys, 'Other']
                                      .map((b) => DropdownMenuItem(value: b, child: Text(b)))
                                      .toList(),
                                  onChanged: (v) {
                                    setState(() {
                                      _selectedBank = v;
                                      if (v != 'Other') _bankNameController.text = v ?? '';
                                      _accountNumberController.clear();
                                    });
                                  },
                                  validator: (v) =>
                                      v == null ? Translations.get('required_field', locale) : null,
                                ),
                                if (_selectedBank == 'Other') ...[
                                  const SizedBox(height: 14),
                                  TextFormField(
                                    controller: _bankNameController,
                                    decoration: AppTheme.inputDecoration(
                                      Translations.get('bank_name', locale),
                                      LucideIcons.pencil,
                                      context: context,
                                    ),
                                    validator: (v) => (v == null || v.isEmpty)
                                        ? Translations.get('required_field', locale)
                                        : null,
                                  ),
                                ],
                                const SizedBox(height: 14),
                                TextFormField(
                                  controller: _accountNumberController,
                                  decoration: AppTheme.inputDecoration(
                                    Translations.get('account_number', locale),
                                    LucideIcons.hash,
                                    context: context,
                                  ).copyWith(counterText: ''),
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                  maxLength: _selectedBank != null && _selectedBank != 'Other'
                                      ? _bankRules[_selectedBank]
                                      : null,
                                  validator: (v) {
                                    if (v == null || v.isEmpty) {
                                      return Translations.get('required_field', locale);
                                    }
                                    if (_selectedBank != null && _selectedBank != 'Other') {
                                      final len = _bankRules[_selectedBank];
                                      if (len != null && v.length != len) {
                                        return 'Must be $len digits';
                                      }
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 14),
                                TextFormField(
                                  controller: _branchController,
                                  decoration: AppTheme.inputDecoration(
                                    Translations.get('branch', locale),
                                    LucideIcons.gitBranch,
                                    context: context,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                          AnimatedButton(
                            label: Translations.get('update_bank_details', locale),
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
    );
  }
}
