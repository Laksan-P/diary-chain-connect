import 'dart:async';
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
import 'support_chat_screen.dart';

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
  String? _nestleName;
  String? _ccPhone;
  String? _ccName;
  int? _expandedId;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _fetchData();
    // Auto-refresh every 30 seconds to ensure "instant" sync
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _fetchData(isSilent: true),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchData({bool isSilent = false}) async {
    if (!isSilent) setState(() => _isLoading = true);
    try {
      final user = context.read<AuthProvider>().user;
      final userRole = user?['role'] ?? 'farmer';

      final faqs = await _api.get('/faq?role=$userRole');
      final phoneConfig = await _api.get('/config?key=nestle_phone');
      final nameConfig = await _api.get('/config?key=nestle_name');

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
                (c) =>
                    c['id'].toString() ==
                    farmerData['chillingCenterId'].toString(),
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
          _nestlePhone = phoneConfig != null
              ? phoneConfig['config_value']
              : null;
          _nestleName = nameConfig != null
              ? nameConfig['config_value']
              : 'Nestlé HQ Support';
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
      backgroundColor: isDark
          ? AppTheme.backgroundDark
          : AppTheme.backgroundLight,
      body: Stack(
        children: [
          // ── PREMIUM DECORATIVE OVERLAYS (MATCHING HOME SCREEN) ──
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.04)
                    : AppTheme.primary.withValues(alpha: 0.03),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: -150,
            left: -50,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                color: isDark
                    ? AppTheme.primaryLight.withValues(alpha: 0.03)
                    : Colors.black.withValues(alpha: 0.01),
                shape: BoxShape.circle,
              ),
            ),
          ),

          // Blur effect
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
              child: Container(color: Colors.transparent),
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
                            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                            physics: const BouncingScrollPhysics(),
                            children: [
                              ..._faqs.map(
                                (faq) => _buildFaqItem(faq, isDark, locale),
                              ),
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
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
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
                color: isDark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.white,
                shape: BoxShape.circle,
                boxShadow: isDark ? [] : AppTheme.premiumShadow,
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

  Widget _buildFaqItem(dynamic faq, bool isDark, String locale) {
    final isExpanded = _expandedId == faq['id'];
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark ? [] : AppTheme.premiumShadow,
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.05)
              : Colors.grey.shade100,
          width: 1,
        ),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(24),
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() => _expandedId = isExpanded ? null : faq['id']);
              if (!isExpanded) _logFeedback(faq['id'], null);
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      locale == 'si' &&
                              faq['question_si'] != null &&
                              faq['question_si'].toString().isNotEmpty
                          ? faq['question_si']
                          : locale == 'ta' &&
                                faq['question_ta'] != null &&
                                faq['question_ta'].toString().isNotEmpty
                          ? faq['question_ta']
                          : faq['question'] ?? '',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Icon(
                    isExpanded
                        ? LucideIcons.chevronUp
                        : LucideIcons.chevronDown,
                    color: isDark ? AppTheme.primaryLight : AppTheme.primary,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: Text(
                locale == 'si' &&
                        faq['answer_si'] != null &&
                        faq['answer_si'].toString().isNotEmpty
                    ? faq['answer_si']
                    : locale == 'ta' &&
                          faq['answer_ta'] != null &&
                          faq['answer_ta'].toString().isNotEmpty
                    ? faq['answer_ta']
                    : faq['answer'] ?? '',
                style: TextStyle(
                  color: isDark ? Colors.grey.shade400 : Colors.grey.shade700,
                  height: 1.6,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOtherIssueCard(String role, String locale, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: (isDark ? AppTheme.primaryLight : AppTheme.primary).withOpacity(
          0.06,
        ),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(
          color: (isDark ? AppTheme.primaryLight : AppTheme.primary)
              .withOpacity(0.12),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            Translations.get('other_issue', locale),
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: isDark ? AppTheme.primaryLight : AppTheme.primary,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            Translations.get('contact_support_desc', locale),
            style: TextStyle(
              color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
              fontSize: 14,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
          BouncingButton(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) =>
                      SupportChatScreen(onBack: () => Navigator.pop(context)),
                ),
              );
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.primary.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      LucideIcons.messageCircle,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          Translations.get('other_issues', locale),
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        Text(
                          Translations.get('type_your_issue', locale),
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark
                                ? Colors.grey.shade400
                                : Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    LucideIcons.chevronRight,
                    color: isDark ? Colors.grey.shade600 : Colors.grey.shade400,
                    size: 18,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

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

          if (_nestlePhone != null && _nestlePhone!.isNotEmpty)
            _buildCallButton(
              title: _nestleName ?? Translations.get('call_nestle', locale),
              subtitle: _nestleName != null
                  ? 'Nestlé Support'
                  : 'Nestlé HQ Support',
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
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.surfaceDark : Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: isDark ? [] : AppTheme.premiumShadow,
          border: isPrimary
              ? Border.all(
                  color: (isDark ? AppTheme.primaryLight : AppTheme.primary)
                      .withOpacity(0.3),
                  width: 1.5,
                )
              : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (isPrimary ? Colors.green : Colors.blue).withOpacity(
                  0.12,
                ),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isPrimary ? LucideIcons.phoneCall : LucideIcons.phone,
                color: isPrimary ? Colors.green : Colors.blue,
                size: 22,
              ),
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 17,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: isDark
                          ? Colors.grey.shade500
                          : Colors.grey.shade500,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              LucideIcons.chevronRight,
              color: Colors.grey.shade400,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
