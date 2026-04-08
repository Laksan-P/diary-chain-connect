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
  final VoidCallback onBack;
  final String mode; // 'supply' or 'payments'

  const PassbookScreen({
    super.key,
    required this.collections,
    required this.payments,
    required this.locale,
    required this.isLoading,
    required this.onRefresh,
    required this.onBack,
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
      body: RefreshIndicator(
        onRefresh: () async => widget.onRefresh(),
        color: AppTheme.primary,
        child: widget.isLoading 
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(child: _buildScrollableHeader(context)),
                SliverToBoxAdapter(child: _buildSummary(context)),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                  sliver: _buildSliverList(context),
                ),
              ],
            ),
      ),
    );
  }

  Widget _buildScrollableHeader(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.only(top: 45, bottom: 12),
      child: Row(
        children: [
          const SizedBox(width: 16),
          _buildCircleBackButton(isDark),
          Expanded(
            child: Text(
              widget.mode == 'supply' ? Translations.get('passbook', widget.locale) : Translations.get('payments', widget.locale),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w900,
                fontSize: 24,
                letterSpacing: -0.5,
              ),
            ),
          ),
          _buildFilterButton(isDark),
          const SizedBox(width: 16),
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
        onPressed: widget.onBack,
      ),
    );
  }

  Widget _buildSummary(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = isDark ? const Color(0xFFFFB000) : AppTheme.primary;
    
    double total = 0;
    String label = "";
    String valuePrefix = "";
    String valueSuffix = "";

    if (widget.mode == 'supply') {
      label = "Total Milk Supplied";
      valueSuffix = " L";
      for (var c in widget.collections) {
        if ((c['qualityResult'] ?? '').toString().toLowerCase() == 'pass') {
          total += double.tryParse(c['quantity'].toString()) ?? 0;
        }
      }
    } else {
      label = "Total Earnings";
      valuePrefix = "Rs. ";
      for (var p in widget.payments) {
        if ((p['status'] ?? '').toString().toLowerCase() == 'paid') {
          total += double.tryParse(p['amount'].toString()) ?? 0;
        }
      }
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark 
              ? [AppTheme.surfaceDark, AppTheme.backgroundDark]
              : [Colors.white, Colors.grey.shade50],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: accentColor.withOpacity(0.05),
            blurRadius: 40,
            offset: const Offset(0, 20),
          ),
        ],
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade100,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  widget.mode == 'supply' ? LucideIcons.droplets : LucideIcons.wallet,
                  size: 16,
                  color: accentColor,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  color: isDark ? Colors.white38 : Colors.grey.shade500,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            "$valuePrefix${total.toStringAsFixed(total == total.toInt() ? 0 : 2)}$valueSuffix",
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontSize: 36,
              fontWeight: FontWeight.w900,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "Based on your latest records",
            style: TextStyle(
              color: isDark ? Colors.white24 : Colors.grey.shade400,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSliverList(BuildContext context) {
    final data = _filteredData;
    if (data.isEmpty) {
      return SliverFillRemaining(
        hasScrollBody: false,
        child: _buildEmptyState(
          widget.mode == 'supply' ? LucideIcons.droplets : LucideIcons.banknote, 
          _statusFilter == 'All' 
              ? 'No records found' 
              : 'No $_statusFilter records'
        ),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final item = data[index];
          if (widget.mode == 'supply') {
            return _buildSupplyCard(context, item);
          } else {
            return _buildPaymentCard(context, item);
          }
        },
        childCount: data.length,
      ),
    );
  }

  Widget _buildFilterButton(bool isDark) {
    return PopupMenuButton<String>(
      onSelected: (value) => setState(() => _statusFilter = value),
      color: isDark ? AppTheme.surfaceDark : Colors.white,
      offset: const Offset(0, 50),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      icon: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: isDark 
              ? (_statusFilter == 'All' ? Colors.white.withOpacity(0.05) : const Color(0xFFFFB000).withOpacity(0.1))
              : (_statusFilter == 'All' ? Colors.grey.shade100 : AppTheme.primary.withOpacity(0.1)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          LucideIcons.filter,
          size: 18,
          color: isDark 
              ? (_statusFilter == 'All' ? Colors.white : const Color(0xFFFFB000))
              : (_statusFilter == 'All' ? Colors.black87 : AppTheme.primary),
        ),
      ),
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

  Widget _buildSupplyCard(BuildContext context, dynamic c) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return _buildPassbookCard(
      context,
      icon: LucideIcons.droplets,
      iconColor: isDark ? Colors.cyanAccent : AppTheme.primary,
      title: 'Collection #${c['id']}',
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
        color: isDark ? AppTheme.surfaceDark.withOpacity(0.5) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade100,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
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
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: isDark ? Colors.white38 : Colors.grey.shade500,
                    fontSize: 11,
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
                  fontSize: 15,
                  color: type == 'supply' ? (isDark ? Colors.cyanAccent : AppTheme.accent) : Colors.green,
                ),
              ),
              const SizedBox(height: 6),
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 8,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _buildEmptyState(IconData icon, String message) {
    return Padding(
      padding: const EdgeInsets.all(40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 60, color: Colors.grey.withOpacity(0.1)),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.grey.withOpacity(0.3),
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }
}
