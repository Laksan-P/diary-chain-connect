import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/translations.dart';
import 'app_theme.dart';
import '../services/api_service.dart';

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
  final ApiService _api = ApiService();
  final Map<String, dynamic> _collectionTests =
      {}; // Cache for on-demand test results

  List<dynamic> get _filteredData {
    if (widget.mode == 'supply') {
      if (_statusFilter == 'All') return widget.collections;
      return widget.collections.where((c) {
        final status = (c['qualityResult'] ?? 'Pending')
            .toString()
            .toLowerCase();
        return status == _statusFilter.toLowerCase();
      }).toList();
    } else {
      List<dynamic> list = widget.payments;
      if (_statusFilter != 'All') {
        list = list.where((p) {
          final status = (p['status'] ?? 'Pending').toString().toLowerCase();
          return status == _statusFilter.toLowerCase();
        }).toList();
      }

      // Always sort by Collection ID descending
      final sortedList = List<dynamic>.from(list);
      sortedList.sort((a, b) {
        final idA = int.tryParse(a['collectionId']?.toString() ?? '0') ?? 0;
        final idB = int.tryParse(b['collectionId']?.toString() ?? '0') ?? 0;
        return idB.compareTo(idA);
      });
      return sortedList;
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
                  if (widget.mode == 'payments')
                    SliverToBoxAdapter(child: _buildPricingInfo(context)),
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
              widget.mode == 'supply'
                  ? Translations.get('passbook', widget.locale)
                  : Translations.get('payments', widget.locale),
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
      label = Translations.get('total_milk_supplied', widget.locale);
      valueSuffix = " L";
      for (var c in widget.collections) {
        if ((c['qualityResult'] ?? '').toString().toLowerCase() == 'pass') {
          total += double.tryParse(c['quantity'].toString()) ?? 0;
        }
      }
    } else {
      label = Translations.get('total_earnings', widget.locale);
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
                  widget.mode == 'supply'
                      ? LucideIcons.droplets
                      : LucideIcons.wallet,
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
            Translations.get('latest_records_msg', widget.locale),
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
              ? Translations.get('no_records_found', widget.locale)
              : Translations.get(
                  'no_status_records',
                  widget.locale,
                  params: {
                    'status': Translations.get(
                      _statusFilter.toLowerCase(),
                      widget.locale,
                    ),
                  },
                ),
        ),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate((context, index) {
        final item = data[index];
        if (widget.mode == 'supply') {
          return _buildSupplyCard(context, item);
        } else {
          return _buildPaymentCard(context, item);
        }
      }, childCount: data.length),
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
              ? (_statusFilter == 'All'
                    ? Colors.white.withOpacity(0.05)
                    : const Color(0xFFFFB000).withOpacity(0.1))
              : (_statusFilter == 'All'
                    ? Colors.grey.shade100
                    : AppTheme.primary.withOpacity(0.1)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          LucideIcons.filter,
          size: 18,
          color: isDark
              ? (_statusFilter == 'All'
                    ? Colors.white
                    : const Color(0xFFFFB000))
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
          : [_filterItem('All'), _filterItem('Paid'), _filterItem('Pending')],
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
              ? (isDark
                    ? const Color(0xFFFFB000).withOpacity(0.1)
                    : AppTheme.primary.withOpacity(0.05))
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
              value == 'All'
                  ? Translations.get('all', widget.locale)
                  : Translations.get(value.toLowerCase(), widget.locale),
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

  Future<void> _fetchCollectionTestData(
    String collectionId,
    StateSetter setModalState,
  ) async {
    try {
      final results = await _api.get(
        '/quality-tests?collectionId=$collectionId',
      );
      if (results != null && results is List && results.isNotEmpty) {
        if (mounted) {
          setState(() {
            _collectionTests[collectionId] = results[0];
          });
          setModalState(() {}); // Update modal UI
        }
      }
    } catch (e) {
      debugPrint("Error fetching test data: $e");
    }
  }

  void _showCollectionDetails(BuildContext context, dynamic c) {
    final collectionId = c['id'].toString();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final milkType = Translations.get(
      c['milkType']?.toString().toLowerCase() ?? 'cow',
      widget.locale,
    );
    final date = Translations.formatDate(
      DateTime.parse(c['date']),
      widget.locale,
    );
    final time = c['time'] ?? '--:--';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          // Check if we have data locally or in cache
          final testData = (c['fat'] != null)
              ? c
              : (_collectionTests[collectionId] ?? {});

          if (testData.isEmpty &&
              c['qualityResult'] != null &&
              c['qualityResult'].toString().toLowerCase() != 'pending') {
            _fetchCollectionTestData(collectionId, setModalState);
          }

          return Container(
            decoration: BoxDecoration(
              color: isDark ? AppTheme.surfaceDark : Colors.white,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(40),
              ),
            ),
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      Translations.get('details', widget.locale),
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    _buildStatusBadge(c['qualityResult'] ?? 'Pending'),
                  ],
                ),
                const SizedBox(height: 32),
                _buildDetailRow(
                  LucideIcons.hash,
                  Translations.get('collection_id', widget.locale),
                  '#$collectionId',
                  isDark,
                ),
                _buildDetailRow(
                  LucideIcons.calendar,
                  Translations.get('date_label', widget.locale),
                  date,
                  isDark,
                ),
                _buildDetailRow(
                  LucideIcons.clock,
                  Translations.get('time_label', widget.locale),
                  time,
                  isDark,
                ),
                _buildDetailRow(
                  LucideIcons.droplets,
                  Translations.get('milk_type', widget.locale),
                  milkType,
                  isDark,
                ),
                _buildDetailRow(
                  LucideIcons.testTube2,
                  Translations.get('quantity', widget.locale),
                  '${c['quantity']} L',
                  isDark,
                  isHighlight: true,
                ),

                if (c['qualityResult'] != null &&
                    c['qualityResult'].toString().toLowerCase() !=
                        'pending') ...[
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(height: 1),
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: _buildQualityBox(
                          Translations.get('fat', widget.locale),
                          '${testData['fat'] ?? '--'}%',
                          isDark,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildQualityBox(
                          Translations.get('snf', widget.locale),
                          '${testData['snf'] ?? '--'}%',
                          isDark,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildQualityBox(
                          Translations.get('water', widget.locale),
                          '${testData['water'] ?? '--'}%',
                          isDark,
                        ),
                      ),
                    ],
                  ),
                ],

                if (c['rejectReason'] != null &&
                    (c['qualityResult']?.toString().toLowerCase() == 'fail' ||
                        c['qualityResult']?.toString().toLowerCase() ==
                            'rejected')) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.red.withOpacity(0.1)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          LucideIcons.alertCircle,
                          color: Colors.red,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                Translations.get('reason_label', widget.locale),
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                              Text(
                                c['rejectReason'].toString(),
                                style: TextStyle(
                                  color: isDark
                                      ? Colors.white70
                                      : Colors.black87,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 48),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showPaymentDetails(BuildContext context, dynamic p) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final date = Translations.formatDate(
      DateTime.parse(p['paidAt'] ?? p['createdAt']),
      widget.locale,
    );

    // Find collections included in this payment
    // Standard logic: payments often match collection IDs if they exist in the object
    final List<dynamic> includedCollections = [];
    if (p['collectionIds'] != null) {
      final ids = (p['collectionIds'] as List)
          .map((id) => id.toString())
          .toList();
      includedCollections.addAll(
        widget.collections.where((c) => ids.contains(c['id'].toString())),
      );
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: isDark ? AppTheme.surfaceDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(40)),
        ),
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  Translations.get('details', widget.locale),
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                _buildStatusBadge(p['status'] ?? 'Pending'),
              ],
            ),
            const SizedBox(height: 32),
            _buildDetailRow(
              LucideIcons.banknote,
              Translations.get('total_amount', widget.locale),
              'Rs. ${p['amount']}',
              isDark,
              isHighlight: true,
            ),
            _buildDetailRow(
              LucideIcons.calendarCheck,
              Translations.get('date_label', widget.locale),
              date,
              isDark,
            ),

            // Show the primary linked collection
            if (p['collectionId'] != null)
              _buildDetailRow(
                LucideIcons.hash,
                Translations.get('collection_id', widget.locale),
                '#${p['collectionId']}',
                isDark,
              ),

            if (includedCollections.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text(
                Translations.get('collections_included', widget.locale),
                style: TextStyle(
                  color: isDark ? Colors.white38 : Colors.grey.shade500,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 12),
              ...includedCollections.map(
                (c) => Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.white.withOpacity(0.03)
                        : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isDark
                          ? Colors.white.withOpacity(0.05)
                          : Colors.grey.shade100,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        LucideIcons.droplets,
                        size: 14,
                        color: isDark
                            ? AppTheme.primaryLight
                            : AppTheme.primary,
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '#${c['id']}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${c['quantity']} L',
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(
    IconData icon,
    String label,
    String value,
    bool isDark, {
    bool isHighlight = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color:
                  (isHighlight
                          ? (isDark
                                ? const Color(0xFFFFB000)
                                : AppTheme.primary)
                          : Colors.grey)
                      .withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 18,
              color: isHighlight
                  ? (isDark ? const Color(0xFFFFB000) : AppTheme.primary)
                  : Colors.grey,
            ),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: isDark ? Colors.white38 : Colors.grey.shade500,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: isHighlight ? 18 : 15,
                  fontWeight: isHighlight ? FontWeight.w900 : FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQualityBox(String label, String value, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.03) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade100,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isDark ? Colors.white38 : Colors.grey.shade500,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }

  Widget _buildSupplyCard(BuildContext context, dynamic c) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final milkType = Translations.get(
      c['milkType']?.toString().toLowerCase() ?? 'cow',
      widget.locale,
    );

    return _buildPassbookCard(
      context,
      icon: LucideIcons.droplets,
      iconColor: isDark ? AppTheme.primaryLight : AppTheme.primary,
      title: '${Translations.get('collection_id', widget.locale)} #${c['id']}',
      subtitle:
          '${DateFormat('MMM dd, yyyy • hh:mm a').format(DateTime.parse('${c['date']} ${c['time'] ?? '00:00:00'}').toLocal())} • $milkType',
      trailing: '${c['quantity']} L',
      status: c['qualityResult'] ?? 'Pending',
      type: 'supply',
      onTap: () => _showCollectionDetails(context, c),
    );
  }

  Widget _buildPaymentCard(BuildContext context, dynamic p) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return _buildPassbookCard(
      context,
      icon: LucideIcons.banknote,
      iconColor: isDark ? Colors.greenAccent : Colors.green,
      title: Translations.get('settlement_amount', widget.locale),
      subtitle: DateFormat(
        'MMM dd, yyyy',
      ).format(DateTime.parse(p['paidAt'] ?? p['createdAt']).toLocal()),
      trailing: 'Rs. ${p['amount']}',
      status: p['status'] ?? 'Pending',
      type: 'payment',
      onTap: () => _showPaymentDetails(context, p),
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
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.surfaceDark.withOpacity(0.5) : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isDark
                ? Colors.white.withOpacity(0.05)
                : Colors.grey.shade100,
          ),
          boxShadow: isDark
              ? []
              : [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
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
                    color: type == 'supply'
                        ? (isDark ? AppTheme.primaryLight : AppTheme.primary)
                        : Colors.green,
                  ),
                ),
                const SizedBox(height: 6),
                _buildStatusBadge(status),
              ],
            ),
          ],
        ),
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
        Translations.get(status.toLowerCase(), widget.locale).toUpperCase(),
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

  Widget _buildPricingInfo(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = isDark ? const Color(0xFFFFB000) : AppTheme.primary;
    final locale = widget.locale;

    // Direct Hardcoded Maps to bypass translation service sync issues
    final Map<String, dynamic> content = {
      'en': {
        'title': 'How we calculate your pay',
        'sub': 'Better quality milk gets you a higher price!',
        'baseL': 'Base Price',
        'baseS': 'Standard: 3.5% Fat, 8.5% SNF',
        'baseV': 'Base Price',
        'bonusL': 'High Quality Bonus',
        'bonusS': 'Extra Fat & Solids (SNF)',
        'bonusV': '+ Bonus',
        'math': 'Formula',
        'formula': 'BASE + FAT BONUS + SNF BONUS',
      },
      'si': {
        'title': 'ගෙවීම් ගණනය කරන ආකාරය',
        'sub': 'කිරිවල ගුණාත්මකභාවය වැඩි වන විට ඔබට වැඩි මුදලක් ලැබේ!',
        'baseL': 'මූලික මිල',
        'baseS': 'සම්මතය: 3.5% මේදය, 8.5% SNF',
        'baseV': 'මූලික මිල',
        'bonusL': 'ගුණාත්මක ප්‍රසාද දීමනාව',
        'bonusS': 'අමතර මේදය සහ SNF සඳහා',
        'bonusV': '+ ප්‍රසාද',
        'math': 'ගණනය කරන ක්‍රමය',
        'formula': 'මූලික + FAT ප්‍රසාද + SNF ප්‍රසාද',
      },
      'ta': {
        'title': 'கொடுப்பனவு எவ்வாறு கணக்கிடப்படுகிறது',
        'sub':
            'பாலின் தரம் சிறப்பாக இருந்தால் உங்களுக்கு அதிக பணம் கிடைக்கும்!',
        'baseL': 'அடிப்படை விலை',
        'baseS': 'நிலை: 3.5% கொழுப்பு, 8.5% SNF',
        'baseV': 'அடிப்படை விலை',
        'bonusL': 'உயர்தர போனஸ்',
        'bonusS': 'கூடுதல் கொழுப்பு மற்றும் SNF க்காக',
        'bonusV': '+ போனஸ்',
        'math': 'கணக்கீட்டு முறை',
        'formula': 'அடிப்படை + FAT போனஸ் + SNF போனஸ்',
      },
    };

    final t = content[locale] ?? content['en'];

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.04) : Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
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
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  LucideIcons.helpCircle,
                  size: 16,
                  color: accentColor,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t['title'],
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                      ),
                    ),
                    Text(
                      t['sub'],
                      style: TextStyle(
                        color: isDark ? Colors.white38 : Colors.grey.shade600,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: isDark ? Colors.black26 : Colors.grey.shade50,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: isDark
                    ? Colors.white.withOpacity(0.05)
                    : Colors.grey.shade200,
              ),
            ),
            child: Column(
              children: [
                _buildComparisonRow(t['baseL'], t['baseS'], t['baseV'], isDark),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Divider(
                    height: 1,
                    color: isDark
                        ? Colors.white.withOpacity(0.05)
                        : Colors.grey.shade200,
                  ),
                ),
                _buildComparisonRow(
                  t['bonusL'],
                  t['bonusS'],
                  t['bonusV'],
                  isDark,
                  isBonus: true,
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                t['math'].toString().toUpperCase(),
                style: TextStyle(
                  color: isDark ? Colors.white24 : Colors.grey.shade400,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                ),
              ),
              Expanded(
                child: Text(
                  t['formula'],
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: isDark ? accentColor : const Color(0xFF1E293B),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildComparisonRow(
    String label,
    String sub,
    String value,
    bool isDark, {
    bool isBonus = false,
  }) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                  color: isBonus
                      ? (isDark
                            ? const Color(0xFF34D399)
                            : const Color(0xFF0D9488))
                      : (isDark ? Colors.white70 : Colors.black87),
                ),
              ),
              Text(
                sub,
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? Colors.white24 : Colors.grey.shade500,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isBonus
                ? (isDark
                      ? const Color(0xFF10B981).withOpacity(0.1)
                      : const Color(0xFF10B981).withOpacity(0.08))
                : (isDark ? Colors.white.withOpacity(0.05) : Colors.white),
            borderRadius: BorderRadius.circular(10),
            border: isDark ? null : Border.all(color: Colors.grey.shade100),
          ),
          child: Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 12,
              color: isBonus
                  ? (isDark ? const Color(0xFF34D399) : const Color(0xFF10B981))
                  : (isDark ? Colors.white70 : Colors.black54),
            ),
          ),
        ),
      ],
    );
  }
}
