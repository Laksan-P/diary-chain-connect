import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../providers/preferences_provider.dart';
import '../services/translations.dart';
import '../services/toast_service.dart';
import 'app_theme.dart';
import '../widgets/bouncing_button.dart';

class SupportChatScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const SupportChatScreen({super.key, this.onBack});

  @override
  State<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends State<SupportChatScreen> {
  final _api = ApiService();
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  List<dynamic> _tickets = [];
  bool _isLoading = true;
  bool _isSending = false;
  String? _errorMessage;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _fetchTickets();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _fetchTickets(isSilent: true),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _fetchTickets({bool isSilent = false}) async {
    if (!isSilent) setState(() => _isLoading = true);
    try {
      final res = await _api.get('/support?markRead=true');
      if (mounted) {
        setState(() {
          _tickets = res is List ? res : [];
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Fetch tickets error: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          // If we had tickets before, keep them, otherwise show error
          if (_tickets.isEmpty) {
             _errorMessage = e.toString().contains('Exception:') 
                ? e.toString().split('Exception:')[1].trim() 
                : e.toString();
          }
        });
      }
    }
  }

  Future<void> _sendTicket() async {
    final msg = _messageController.text.trim();
    if (msg.isEmpty) return;

    final prefs = context.read<AppPreferences>();
    final locale = prefs.locale.languageCode;

    setState(() => _isSending = true);
    HapticFeedback.mediumImpact();

    try {
      await _api.post('/support', {'message': msg, 'language': locale});
      _messageController.clear();
      await _fetchTickets(isSilent: true);
      if (mounted) {
        ToastService.show(context, Translations.get('message_sent', locale));
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        ToastService.show(context, 'Failed to send message', isError: true);
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final prefs = context.watch<AppPreferences>();
    final locale = prefs.locale.languageCode;

    return Scaffold(
      backgroundColor: isDark
          ? AppTheme.backgroundDark
          : AppTheme.backgroundLight,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () {
            HapticFeedback.lightImpact();
            if (widget.onBack != null) {
              widget.onBack!();
            } else {
              Navigator.pop(context);
            }
          },
        ),
        title: Text(
          Translations.get('support_chat', locale),
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                ? _buildErrorState(_errorMessage!, locale, isDark)
                : _tickets.isEmpty
                ? _buildEmptyState(locale, isDark)
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(20),
                    reverse: true,
                    itemCount: _tickets.length,
                    itemBuilder: (context, index) =>
                        _buildTicketBubble(_tickets[index], isDark, locale),
                  ),
          ),
          _buildInputArea(isDark, locale),
        ],
      ),
    );
  }

  Widget _buildEmptyState(String locale, bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            LucideIcons.messageSquare,
            size: 64,
            color: Colors.grey.withOpacity(0.3),
          ),
          const SizedBox(height: 16),
          Text(
            Translations.get('no_messages_yet', locale),
            style: TextStyle(
              color: Colors.grey.shade500,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(String error, String locale, bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.alertCircle, size: 48, color: Colors.red.shade300),
            const SizedBox(height: 16),
            Text(
              'Failed to load messages',
              style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
            ),
            const SizedBox(height: 24),
            BouncingButton(
              onTap: _fetchTickets,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(
                  color: AppTheme.primary,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('Try Again', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTicketBubble(dynamic ticket, bool isDark, String locale) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // User Message
        Container(
          margin: const EdgeInsets.only(left: 40, bottom: 4),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.primary,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
              bottomLeft: Radius.circular(20),
              bottomRight: Radius.circular(4),
            ),
          ),
          child: Text(
            ticket['message'],
            style: const TextStyle(color: Colors.white, fontSize: 15),
          ),
        ),
        Text(
          DateTime.parse(
            ticket['created_at'],
          ).toLocal().toString().substring(11, 16),
          style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
        ),
        const SizedBox(height: 16),

        // Nestlé Reply
        if (ticket['reply'] != null) ...[
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              margin: const EdgeInsets.only(right: 40, bottom: 4),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.surfaceDark : Colors.white,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                  bottomLeft: Radius.circular(4),
                  bottomRight: Radius.circular(20),
                ),
                border: Border.all(color: Colors.grey.withOpacity(0.1)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        LucideIcons.building,
                        size: 12,
                        color: isDark
                            ? AppTheme.primaryLight
                            : AppTheme.primary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        Translations.get(
                          ticket['replied_by'] == 'chilling_center'
                              ? 'cc_reply'
                              : 'nestle_reply',
                          locale,
                        ).toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isDark
                              ? AppTheme.primaryLight
                              : AppTheme.primary.withOpacity(0.7),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    (locale == 'si' &&
                            ticket['reply_si'] != null &&
                            ticket['reply_si'].toString().isNotEmpty)
                        ? ticket['reply_si']
                        : (locale == 'ta' &&
                              ticket['reply_ta'] != null &&
                              ticket['reply_ta'].toString().isNotEmpty)
                        ? ticket['reply_ta']
                        : ticket['reply'] ?? '',
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              DateTime.parse(
                ticket['replied_at'],
              ).toLocal().toString().substring(11, 16),
              style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
            ),
          ),
          const SizedBox(height: 24),
        ] else ...[
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.amber.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: 10,
                    height: 10,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.amber,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    Translations.get(
                      ticket['cc_id'] != null
                          ? 'waiting_for_cc'
                          : 'waiting_for_nestle',
                      locale,
                    ),
                    style: const TextStyle(
                      fontSize: 10,
                      color: Colors.amber,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ],
    );
  }

  Widget _buildInputArea(bool isDark, String locale) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 30),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: isDark ? Colors.white10 : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: _messageController,
                decoration: InputDecoration(
                  hintText: Translations.get('type_your_issue', locale),
                  border: InputBorder.none,
                  hintStyle: TextStyle(color: Colors.grey.shade500),
                ),
                maxLines: null,
                textCapitalization: TextCapitalization.sentences,
              ),
            ),
          ),
          const SizedBox(width: 12),
          BouncingButton(
            onTap: () {
              if (!_isSending) _sendTicket();
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                color: AppTheme.primary,
                shape: BoxShape.circle,
              ),
              child: _isSending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(LucideIcons.send, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}
