import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'dart:ui';
import '../services/api_service.dart';
import '../services/translations.dart';
import '../services/toast_service.dart';
import '../providers/auth_provider.dart';
import '../providers/preferences_provider.dart';
import 'app_theme.dart';
import '../widgets/bouncing_button.dart';

class FaqScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const FaqScreen({super.key, this.onBack});

  @override
  State<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends State<FaqScreen> {
  final _api = ApiService();
  bool _isLoading = true;
  List<dynamic> _faqs = [];
  String? _nestlePhone;
  String? _ccPhone;
  String? _ccName;
  int? _expandedId;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final user = context.read<AuthProvider>().user;
      final userRole = user?['role'] ?? 'farmer';
      
      // 1. Fetch FAQs
      final faqs = await _api.get('/faq?role=$userRole');
      
      // 2. Fetch Nestlé config
      final config = await _api.get('/config?key=nestle_phone');
      
      // 3. Fetch CC details if farmer
      String? ccPhone;
      String? ccName;
      
      if (userRole == 'farmer') {
        final farmerId = user?['farmerId'];
        if (farmerId != null) {
          final farmerData = await _api.get('/farmers?action=get&id=$farmerId');
          if (farmerData != null && farmerData['chillingCenterId'] != null) {
            ccName = farmerData['chillingCenterName'];
            final centers = await _api.get('/chilling-centers?action=list');
            if (centers is List) {
              final cc = centers.firstWhere(
                (c) => c['id'].toString() == farmerData['chillingCenterId'].toString(),
                orElse: () => null,
              );
              if (cc != null) {
                ccPhone = cc['phone_number'];
              }
            }
          }
        }
      }

      if (mounted) {
        setState(() {
          _faqs = faqs is List ? faqs : [];
          _nestlePhone = config != null ? config['config_value'] : null;
          _ccPhone = ccPhone;
          _ccName = ccName;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('FAQ Fetch Error: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _logFeedback(int? questionId, String? additionalInfo) async {
    try {
      await _api.post('/feedback-logs', {
        'question_id': questionId,
        'additional_info': additionalInfo,
      });
    } catch (e) {
      debugPrint('Failed to log feedback: $e');
    }
  }

  Future<void> _makePhoneCall(String phoneNumber) async {
    final Uri launchUri = Uri(scheme: 'tel', path: phoneNumber);
    if (await canLaunchUrl(launchUri)) {
      await launchUrl(launchUri);
    } else {
      if (mounted) {
        ToastService.show(context, 'Could not launch dialer', isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<AppPreferences>();
    final locale = prefs.locale.languageCode;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final userRole = context.read<AuthProvider>().user?['role'] ?? 'farmer';

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // Premium Background Overlay
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
              child: Container(
                color: (isDark ? Colors.black : Colors.white).withOpacity(0.85),
              ),
            ),
          ),
          
          SafeArea(
            child: Column(
              children: [
                _buildHeader(locale, isDark),
                Expanded(
                  child: _isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : RefreshIndicator(
                          onRefresh: _fetchData,
                          child: ListView(
                            padding: const EdgeInsets.all(24),
                            children: [
                              ..._faqs.map((faq) => _buildFaqItem(faq, isDark)),
                              const SizedBox(height: 24),
                              _buildOtherIssueCard(userRole, locale, isDark),
                            ],
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

  Widget _buildHeader(String locale, bool isDark) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
      child: Row(
        children: [
          BouncingButton(
            onTap: () {
              HapticFeedback.lightImpact();
              widget.onBack?.call();
            },
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.arrow_back_ios_new_rounded,
                color: isDark ? Colors.white : Colors.black87,
                size: 16,
              ),
            ),
          ),
          Expanded(
            child: Text(
              Translations.get('faq_support', locale),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w900,
                fontSize: 24,
                letterSpacing: -0.5,
              ),
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }

  Widget _buildFaqItem(dynamic faq, bool isDark) {
    final isExpanded = _expandedId == faq['id'];
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppTheme.premiumShadow,
        border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade50),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() => _expandedId = isExpanded ? null : faq['id']);
              if (!isExpanded) _logFeedback(faq['id'], null);
            },
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      faq['question'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ),
                  Icon(
                    isExpanded ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                    color: isDark ? AppTheme.primaryLight : AppTheme.primary,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: Text(
                faq['answer'] ?? '',
                style: TextStyle(
                  color: isDark ? Colors.grey.shade400 : Colors.grey.shade700,
                  height: 1.6,
                  fontSize: 15,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOtherIssueCard(String role, String locale, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: (isDark ? AppTheme.primaryLight : AppTheme.primary).withOpacity(0.08),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: (isDark ? AppTheme.primaryLight : AppTheme.primary).withOpacity(0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            Translations.get('other_issue', locale),
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: isDark ? AppTheme.primaryLight : AppTheme.primary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            Translations.get('contact_support_desc', locale),
            style: TextStyle(color: isDark ? Colors.grey.shade400 : Colors.grey.shade700, fontSize: 14),
          ),
          const SizedBox(height: 24),
          
          // PRIMARY: CALL CC
          if (role == 'farmer' && _ccPhone != null && _ccPhone!.isNotEmpty) ...[
            _buildCallButton(
              title: Translations.get('call_cc', locale),
              subtitle: _ccName ?? 'Your Chilling Center',
              phone: _ccPhone!,
              isDark: isDark,
              isPrimary: true,
            ),
            const SizedBox(height: 16),
          ],
          
          // SECONDARY: CALL NESTLE
          if (_nestlePhone != null && _nestlePhone!.isNotEmpty)
            _buildCallButton(
              title: Translations.get('call_nestle', locale),
              subtitle: 'Nestlé HQ Support',
              phone: _nestlePhone!,
              isDark: isDark,
              isPrimary: false,
            ),
        ],
      ),
    );
  }

  Widget _buildCallButton({
    required String title, 
    required String subtitle,
    required String phone, 
    required bool isDark,
    required bool isPrimary,
  }) {
    return BouncingButton(
      onTap: () {
        HapticFeedback.mediumImpact();
        _logFeedback(null, 'Called: $title ($phone)');
        _makePhoneCall(phone);
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.surfaceDark : Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: AppTheme.premiumShadow,
          border: isPrimary ? Border.all(color: (isDark ? AppTheme.primaryLight : AppTheme.primary).withOpacity(0.3)) : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: (isPrimary ? Colors.green : Colors.blue).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isPrimary ? LucideIcons.phoneCall : LucideIcons.phone, 
                color: isPrimary ? Colors.green : Colors.blue, 
                size: 20
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ],
              ),
            ),
            Icon(LucideIcons.chevronRight, color: Colors.grey.shade400, size: 18),
          ],
        ),
      ),
    );
  }
}
