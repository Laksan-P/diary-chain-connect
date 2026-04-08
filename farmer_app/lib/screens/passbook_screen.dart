import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/translations.dart';
import 'app_theme.dart';

class PassbookScreen extends StatefulWidget {
  final List<dynamic> collections;
  final List<dynamic> payments;
  final String locale;
  final bool isLoading;
  final VoidCallback onRefresh;
  final String mode; // 'supply' or 'payments'

  const PassbookScreen({
    super.key,
    required this.collections,
    required this.payments,
    required this.locale,
    required this.isLoading,
    required this.onRefresh,
    required this.mode,
  });

  @override
  State<PassbookScreen> createState() => _PassbookScreenState();
}

class _PassbookScreenState extends State<PassbookScreen> {
  String _statusFilter = 'All';

  List<dynamic> get _filteredData {
    if (widget.mode == 'supply') {
      if (_statusFilter == 'All') return widget.collections;
      return widget.collections.where((c) {
        final status = (c['qualityResult'] ?? 'Pending').toString().toLowerCase();
        return status == _statusFilter.toLowerCase();
      }).toList();
    } else {
      if (_statusFilter == 'All') return widget.payments;
      return widget.payments.where((p) {
        final status = (p['status'] ?? 'Pending').toString().toLowerCase();
        return status == _statusFilter.toLowerCase();
      }).toList();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: isDark ? AppTheme.surfaceDark : Colors.white,
        elevation: 0,
        title: Text(
          widget.mode == 'supply' ? Translations.get('passbook', widget.locale) : Translations.get('payments', widget.locale),
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black87,
            fontWeight: FontWeight.w900,
            fontSize: 24,
            letterSpacing: -0.5,
          ),
        ),
        actions: [
          _buildFilterButton(isDark),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => widget.onRefresh(),
        color: AppTheme.primary,
        child: widget.isLoading 
          ? const Center(child: CircularProgressIndicator())
          : _buildList(context),
      ),
    );
  }

  Widget _buildFilterButton(bool isDark) {
    return PopupMenuButton<String>(
      onSelected: (value) => setState(() => _statusFilter = value),
      color: isDark ? AppTheme.surfaceDark : Colors.white,
      icon: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: isDark 
              ? (_statusFilter == 'All' ? Colors.white.withOpacity(0.05) : const Color(0xFFFFB000).withOpacity(0.1))
              : (_statusFilter == 'All' ? Colors.grey.shade100 : AppTheme.primary.withOpacity(0.1)),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark 
                ? (_statusFilter == 'All' ? Colors.white12 : const Color(0xFFFFB000).withOpacity(0.3))
                : (_statusFilter == 'All' ? Colors.grey.shade200 : AppTheme.primary.withOpacity(0.3)),
          ),
        ),
        child: Icon(
          LucideIcons.filter,
          size: 18,
          color: isDark 
              ? (_statusFilter == 'All' ? Colors.white : const Color(0xFFFFB000))
              : (_statusFilter == 'All' ? Colors.black87 : AppTheme.primary),
        ),
      ),
      offset: const Offset(0, 50),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      itemBuilder: (context) => widget.mode == 'supply' 
        ? [
            _filterItem('All'),
            _filterItem('Pass'),
            _filterItem('Fail'),
            _filterItem('Pending'),
          ]
        : [
            _filterItem('All'),
            _filterItem('Paid'),
            _filterItem('Pending'),
          ],
    );
  }

  PopupMenuItem<String> _filterItem(String value) {
    bool isSelected = _statusFilter == value;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return PopupMenuItem(
      value: value,
      padding: EdgeInsets.zero,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected 
              ? (isDark ? const Color(0xFFFFB000).withOpacity(0.1) : AppTheme.primary.withOpacity(0.05))
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            if (isSelected) 
              Container(
                width: 4,
                height: 16,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFFFFB000) : AppTheme.primary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            if (isSelected) const SizedBox(width: 8),
            Text(
              value,
              style: TextStyle(
                fontWeight: isSelected ? FontWeight.w900 : FontWeight.normal,
                color: isSelected 
                    ? (isDark ? const Color(0xFFFFB000) : AppTheme.primary) 
                    : (isDark ? Colors.white70 : Colors.black87),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context) {
    final data = _filteredData;
    if (data.isEmpty) {
      return _buildEmptyState(
        widget.mode == 'supply' ? LucideIcons.droplets : LucideIcons.banknote, 
        _statusFilter == 'All' 
            ? 'No records found' 
            : 'No $_statusFilter records'
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: data.length,
      itemBuilder: (context, index) {
        final item = data[index];
        if (widget.mode == 'supply') {
          return _buildSupplyCard(context, item);
        } else {
          return _buildPaymentCard(context, item);
        }
      },
    );
  }

  Widget _buildSupplyCard(BuildContext context, dynamic c) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return _buildPassbookCard(
      context,
      icon: LucideIcons.droplets,
      iconColor: isDark ? Colors.cyanAccent : AppTheme.primary,
      title: '${Translations.get('collection_id', widget.locale)} #${c['id']}',
      subtitle: DateFormat('MMM dd, yyyy • hh:mm a').format(DateTime.parse('${c['date']} ${c['time'] ?? '00:00:00'}')),
      trailing: '${c['quantity']} L',
      status: c['qualityResult'] ?? 'Pending',
      type: 'supply',
    );
  }

  Widget _buildPaymentCard(BuildContext context, dynamic p) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return _buildPassbookCard(
      context,
      icon: LucideIcons.banknote,
      iconColor: isDark ? Colors.greenAccent : Colors.green,
      title: 'Settlement Amount',
      subtitle: DateFormat('MMM dd, yyyy').format(DateTime.parse(p['paidAt'] ?? p['createdAt'])),
      trailing: 'Rs. ${p['amount']}',
      status: p['status'] ?? 'Pending',
      type: 'payment',
    );
  }

  Widget _buildPassbookCard(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String trailing,
    required String status,
    required String type,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.grey.shade100,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.grey.shade500,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                trailing,
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: type == 'supply' ? AppTheme.accent : Colors.green,
                ),
              ),
              const SizedBox(height: 4),
              _buildStatusBadge(status),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    switch (status.toLowerCase()) {
      case 'pass':
      case 'paid':
      case 'approved':
        color = Colors.green;
        break;
      case 'fail':
      case 'rejected':
        color = Colors.red;
        break;
      default:
        color = Colors.orange;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildEmptyState(IconData icon, String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Colors.grey.withOpacity(0.2)),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(
              color: Colors.grey.withOpacity(0.5),
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
