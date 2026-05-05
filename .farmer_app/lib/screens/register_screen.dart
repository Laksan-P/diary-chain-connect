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

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _api = ApiService();
  final _formKey = GlobalKey<FormState>();

  final _controllers = {
    'name': TextEditingController(),
    'email': TextEditingController(),
    'password': TextEditingController(),
    'address': TextEditingController(),
    'phone': TextEditingController(),
    'nic': TextEditingController(),
    'bankName': TextEditingController(),
    'accountNumber': TextEditingController(),
    'branch': TextEditingController(),
  };

  int? _selectedCenter;
  List<dynamic> _centers = [];
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _selectedBank;

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
    'Other': 20,
  };

  StreamSubscription<bool>? _connectivitySub;

  @override
  void initState() {
    super.initState();
    _fetchCenters();
    _connectivitySub = OfflineService().connectivityStream.listen((isOnline) {
      if (isOnline && _centers.isEmpty) {
        _fetchCenters();
      }
    });
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    for (var c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _fetchCenters() async {
    if (!OfflineService().isOnline) {
      final cached = OfflineService().getCachedData('chilling_centers');
      if (cached != null && mounted) {
        setState(() => _centers = List<dynamic>.from(cached));
      }
      return;
    }

    try {
      final res = await _api.get('/chilling-centers?action=list');
      if (mounted) {
        setState(() => _centers = res);
        await OfflineService().saveCachedData('chilling_centers', res);
      }
    } catch (e) {
      final cached = OfflineService().getCachedData('chilling_centers');
      if (cached != null && mounted) {
        setState(() => _centers = List<dynamic>.from(cached));
      }
    }
  }

  Future<void> _handleRegister() async {
    HapticFeedback.mediumImpact();
    if (!_formKey.currentState!.validate()) {
      ToastService.show(
        context,
        'Please correct the validation errors',
        isError: true,
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final data = _controllers.map((k, v) => MapEntry(k, v.text.trim()));
      data['chillingCenterId'] = _selectedCenter!.toString();

      if (!OfflineService().isOnline) {
        await OfflineService().addPendingAction(
          '/auth?action=register-farmer',
          'POST',
          data,
        );
        if (mounted) {
          ToastService.show(
            context,
            'Signed up offline! We will finalize your registration when you are back online.',
          );
          Navigator.pop(context);
        }
        return;
      }

      await context.read<AuthProvider>().register(data);
      if (mounted) {
        ToastService.show(
          context,
          'Registration Successful! Welcome to Nestlé Farmer App.',
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ToastService.show(
          context,
          e.toString().replaceAll('Exception: ', ''),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<AppPreferences>();
    final locale = prefs.locale.languageCode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 120),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Scrollable Banner (moves with the form)
                    OfflineBanner(locale: locale),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            Navigator.pop(context);
                          },
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? Colors.white.withOpacity(0.05)
                                  : Colors.grey.shade100,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              LucideIcons.chevronLeft,
                              size: 20,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),
                    Text(
                      Translations.get('farmer_registration', locale),
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -1,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      Translations.get('join_network', locale),
                      style: TextStyle(
                        fontSize: 14,
                        color: isDark ? Colors.white60 : Colors.grey.shade500,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 48),
                    _sectionTitle(Translations.get('personal_details', locale)),
                    _field(
                      'name',
                      Translations.get('full_name', locale),
                      LucideIcons.user,
                      locale,
                      hint: 'e.g. Sunil Perera',
                    ),
                    _field(
                      'nic',
                      Translations.get('nic', locale),
                      LucideIcons.creditCard,
                      locale,
                      hint: 'e.g. 199012345678',
                    ),
                    _field(
                      'address',
                      Translations.get('address', locale),
                      LucideIcons.mapPin,
                      locale,
                      hint: 'e.g. 123 Main St, Kandy',
                    ),
                    _field(
                      'phone',
                      Translations.get('phone', locale),
                      LucideIcons.phone,
                      locale,
                      hint: 'e.g. 0771234567',
                    ),
                    const SizedBox(height: 16),
                    _centers.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: TextFormField(
                              enabled: false,
                              decoration:
                                  AppTheme.inputDecoration(
                                    'Chilling Center',
                                    LucideIcons.warehouse,
                                    context: context,
                                  ).copyWith(
                                    hintText: 'Check network connection...',
                                  ),
                              validator: (v) =>
                                  'Unable to fetch chilling centers',
                            ),
                          )
                        : Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: DropdownButtonFormField<int>(
                              value: _selectedCenter,
                              decoration: AppTheme.inputDecoration(
                                'Chilling Center',
                                LucideIcons.warehouse,
                                context: context,
                              ),
                              items: _centers.map<DropdownMenuItem<int>>((c) {
                                return DropdownMenuItem<int>(
                                  value: c['id'],
                                  child: Text(c['name']),
                                );
                              }).toList(),
                              onChanged: (v) =>
                                  setState(() => _selectedCenter = v),
                              validator: (v) => v == null
                                  ? Translations.get('required_field', locale)
                                  : null,
                            ),
                          ),
                    const SizedBox(height: 24),
                    _sectionTitle(Translations.get('bank_details', locale)),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: DropdownButtonFormField<String>(
                        value: _selectedBank,
                        decoration: AppTheme.inputDecoration(
                          Translations.get('bank_name', locale),
                          LucideIcons.landmark,
                          context: context,
                        ),
                        items: _bankRules.keys
                            .map(
                              (bank) => DropdownMenuItem(
                                value: bank,
                                child: Text(bank),
                              ),
                            )
                            .toList(),
                        onChanged: (v) {
                          setState(() {
                            _selectedBank = v;
                            _controllers['bankName']!.text = v ?? '';
                            _controllers['accountNumber']!.clear();
                          });
                        },
                        validator: (v) => v == null
                            ? Translations.get('required_field', locale)
                            : null,
                      ),
                    ),
                    _field(
                      'accountNumber',
                      Translations.get('account_number', locale),
                      LucideIcons.hash,
                      locale,
                      hint: _selectedBank != null && _selectedBank != 'Other'
                          ? 'Required: ${_bankRules[_selectedBank]} digits'
                          : 'e.g. 123456789',
                    ),
                    _field(
                      'branch',
                      Translations.get('branch', locale),
                      LucideIcons.gitBranch,
                      locale,
                      hint: 'e.g. Kandy Central',
                    ),
                    const SizedBox(height: 40),
                    _sectionTitle(
                      Translations.get('account_credentials', locale),
                    ),
                    _field(
                      'email',
                      Translations.get('email', locale),
                      LucideIcons.mail,
                      locale,
                      type: TextInputType.emailAddress,
                      hint: 'e.g. sunil@example.com',
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: TextFormField(
                        controller: _controllers['password'],
                        decoration:
                            AppTheme.inputDecoration(
                              Translations.get('password', locale),
                              LucideIcons.lock,
                              hint: 'Create a strong password',
                              context: context,
                            ).copyWith(
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? LucideIcons.eye
                                      : LucideIcons.eyeOff,
                                  size: 20,
                                  color: Colors.grey.shade400,
                                ),
                                onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword,
                                ),
                              ),
                            ),
                        obscureText: _obscurePassword,
                        validator: (v) => v == null || v.isEmpty
                            ? Translations.get('required_field', locale)
                            : null,
                      ),
                    ),
                    const SizedBox(height: 48),
                    ElevatedButton(
                      onPressed: _isLoading ? null : _handleRegister,
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
                          : Text(
                              Translations.get('complete_registration', locale),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w900,
          color: Colors.grey,
          letterSpacing: 1,
        ),
      ),
    );
  }

  Widget _field(
    String key,
    String label,
    IconData icon,
    String locale, {
    TextInputType? type,
    bool obscure = false,
    String? hint,
  }) {
    int? maxLength;
    List<TextInputFormatter>? formatters;
    TextInputType? keyboardType = type;

    if (key == 'phone') {
      maxLength = 10;
      formatters = [FilteringTextInputFormatter.digitsOnly];
      keyboardType = TextInputType.phone;
    } else if (key == 'nic') {
      maxLength = 12;
      formatters = [FilteringTextInputFormatter.allow(RegExp(r'[0-9vVxX]'))];
    } else if (key == 'accountNumber') {
      if (_selectedBank != null) {
        maxLength = _bankRules[_selectedBank];
      }
      formatters = [FilteringTextInputFormatter.digitsOnly];
      keyboardType = TextInputType.number;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: _controllers[key],
        decoration: AppTheme.inputDecoration(
          label,
          icon,
          hint: hint,
          context: context,
        ).copyWith(counterText: ''),
        keyboardType: keyboardType,
        obscureText: obscure,
        maxLength: maxLength,
        inputFormatters: formatters,
        validator: (v) {
          if (v == null || v.isEmpty) {
            return Translations.get('required_field', locale);
          }
          if (key == 'email' &&
              !RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(v)) {
            return 'Invalid email';
          }
          if (key == 'phone') {
            if (v.length != 10) return 'Phone number must be 10 digits';
            if (!RegExp(r'^[0-9]{10}$').hasMatch(v)) {
              return 'Invalid phone number';
            }
          }
          if (key == 'nic' &&
              !RegExp(r'^([0-9]{9}[vVxX]|[0-9]{12})$').hasMatch(v)) {
            return 'Invalid NIC (e.g. 123456789V or 12-digit)';
          }
          if (key == 'accountNumber' && _selectedBank != null) {
            final requiredLength = _bankRules[_selectedBank];
            if (v.length != requiredLength) {
              return 'Account number must be $requiredLength digits for $_selectedBank';
            }
          }
          return null;
        },
      ),
    );
  }
}
