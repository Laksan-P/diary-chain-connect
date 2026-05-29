import 'package:intl/intl.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/translations.dart';
import '../widgets/farmer/hero_summary_card.dart';
import '../widgets/farmer/record_cards.dart';
import '../widgets/collection_timeline.dart';
import '../widgets/status_chip.dart';
import 'app_theme.dart';
import '../services/api_service.dart';
import '../services/offline_service.dart';
import '../widgets/glass_card.dart';
import '../theme/design_tokens.dart';
import '../utils/collection_status_helper.dart';

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
    List<dynamic> source = [];
    if (widget.mode == 'supply') {
      source = List<dynamic>.from(widget.collections);
      // Add pending collections
      final pending = OfflineService()
          .getPendingActions()
          .where((a) => a['path'] == '/collections' && a['method'] == 'POST')
          .map(
            (a) => {
              ...a['body'],
              'id': a['id'],
              'qualityResult': 'Pending Sync',
              'isOffline': true,
            },
          )
          .toList();
      source.insertAll(0, pending);

      if (_statusFilter == 'All') return source;
      return source.where((c) {
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
      body: Stack(
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
          RefreshIndicator(
            onRefresh: () async => widget.onRefresh(),
            color: AppTheme.primary,
            child: widget.isLoading
                ? const Center(child: CircularProgressIndicator())
                : CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverToBoxAdapter(
                        child: _buildScrollableHeader(context),
                      ),
                      SliverToBoxAdapter(child: _buildSummary(context)),
                      SliverToBoxAdapter(child: _buildFilterChips(context)),
                      if (widget.mode == 'payments')
                        SliverToBoxAdapter(child: _buildPricingInfo(context)),
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                        sliver: _buildSliverList(context),
                      ),
                    ],
                  ),
          ),
        ],
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
        onPressed: () {
          HapticFeedback.lightImpact();
          widget.onBack();
        },
      ),
    );
  }

  Widget _buildSummary(BuildContext context) {
    double total = 0;
    String label = "";
    String valuePrefix = "";
    String valueSuffix = "";
    IconData icon;
    final now = DateTime.now();

    if (widget.mode == 'supply') {
      label = Translations.get('total_milk_supplied', widget.locale);
      valueSuffix = " L";
      icon = LucideIcons.droplets;
      for (var c in widget.collections) {
        try {
          final raw = c['createdAt'] ?? c['date'];
          if (raw == null) continue;
          final date = DateTime.parse(raw.toString());
          if (date.month != now.month || date.year != now.year) continue;
        } catch (_) {
          continue;
        }
        if ((c['qualityResult'] ?? '').toString().toLowerCase() == 'pass') {
          total += double.tryParse(c['quantity'].toString()) ?? 0;
        }
      }
    } else {
      label = Translations.get('total_earnings', widget.locale);
      valuePrefix = "Rs. ";
      icon = LucideIcons.wallet;
      for (var p in widget.payments) {
        try {
          final raw = p['createdAt'] ?? p['paidAt'];
          if (raw == null) continue;
          final date = DateTime.parse(raw.toString());
          if (date.month != now.month || date.year != now.year) continue;
        } catch (_) {
          continue;
        }
        if ((p['status'] ?? '').toString().toLowerCase() == 'paid') {
          total += double.tryParse(p['amount'].toString()) ?? 0;
        }
      }
    }

    return HeroSummaryCard(
      label: label,
      value:
          "$valuePrefix${total.toStringAsFixed(total == total.toInt() ? 0 : 2)}$valueSuffix",
      icon: icon,
      subtitle: Translations.get('this_month', widget.locale),
    );
  }

  Widget _buildFilterChips(BuildContext context) {
    final values = widget.mode == 'supply'
        ? ['All', 'Pass', 'Fail', 'Pending']
        : ['All', 'Paid', 'Pending'];
    final labels = values
        .map(
          (v) => v == 'All'
              ? Translations.get('all', widget.locale)
              : Translations.get(v.toLowerCase(), widget.locale),
        )
        .toList();

    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 8),
      child: FilterChipBar(
        values: values,
        labels: labels,
        selected: _statusFilter,
        onSelected: (value) {
          HapticFeedback.selectionClick();
          setState(() => _statusFilter = value);
        },
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
      onSelected: (value) {
        HapticFeedback.selectionClick();
        setState(() => _statusFilter = value);
      },
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
    // If offline, try to load from cache first
    if (!OfflineService().isOnline) {
      final cached = OfflineService().getCachedData('test_$collectionId');
      if (cached != null) {
        if (mounted) {
          setState(() {
            _collectionTests[collectionId] = cached;
          });
          setModalState(() {});
        }
      }
      return;
    }

    try {
      final results = await _api.get(
        '/quality-tests?collectionId=$collectionId',
      );
      if (results != null && results is List && results.isNotEmpty) {
        if (mounted) {
          final testData = results[0];
          setState(() {
            _collectionTests[collectionId] = testData;
          });
          // Save to persistent cache
          await OfflineService().saveCachedData('test_$collectionId', testData);
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

          dynamic linkedPayment;
          for (final p in widget.payments) {
            if (p['collectionId']?.toString() == collectionId) {
              linkedPayment = p;
              break;
            }
            final ids = p['collectionIds'];
            if (ids is List && ids.any((e) => e.toString() == collectionId)) {
              linkedPayment = p;
              break;
            }
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
                    _buildCollectionQualityBadge(c),
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

                if ((CollectionStatusHelper.isQualityFail(c) ||
                    CollectionStatusHelper.normalizeDispatchStatus(c) ==
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
                                CollectionStatusHelper.translatedFailureReason(
                                  c,
                                  widget.locale,
                                ).isNotEmpty
                                    ? CollectionStatusHelper.translatedFailureReason(
                                        c,
                                        widget.locale,
                                      )
                                    : Translations.get(
                                        'unknown_error',
                                        widget.locale,
                                      ),
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

                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Divider(height: 1),
                ),
                CollectionTimeline(
                  locale: widget.locale,
                  collection: c,
                  payment: linkedPayment,
                  testData: testData.isEmpty ? null : testData,
                ),
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
    return CollectionRecordCard(
      locale: widget.locale,
      record: c,
      onTap: () => _showCollectionDetails(context, c),
    );
  }

  Widget _buildPaymentCard(BuildContext context, dynamic p) {
    return PaymentRecordCard(
      locale: widget.locale,
      record: p,
      onTap: () => _showPaymentDetails(context, p),
    );
  }

  Widget _buildCollectionQualityBadge(dynamic collection) {
    final displayKey = CollectionStatusHelper.qualityDisplayKey(collection);
    return StatusChip(
      status: displayKey,
      displayKey: displayKey,
      locale: widget.locale,
      compact: true,
    );
  }

  Widget _buildStatusBadge(String status) {
    final normalized = status.toLowerCase() == 'pending sync'
        ? 'Pending Sync'
        : status;
    return StatusChip(
      status: normalized,
      locale: widget.locale,
      compact: true,
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
    final locale = widget.locale;
    final breakdown = _PaymentExplanationBreakdown.fromPayments(
      widget.payments,
      widget.collections,
    );

    String t(String key, {Map<String, String>? params}) =>
        Translations.get(key, locale, params: params);

    String money(double value) => NumberFormat('#,##0').format(value.round());
    String qtyLabel(double qty) =>
        qty == qty.roundToDouble() ? qty.round().toString() : qty.toStringAsFixed(1);

    return GlassCard(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      padding: const EdgeInsets.all(22),
      borderRadius: 28,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: isDark ? 0.18 : 0.10),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  LucideIcons.calculator,
                  size: 18,
                  color: isDark ? AppTheme.primaryLight : AppTheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('payment_calc_title'),
                      style: TextStyle(
                        color: isDark ? Colors.white : AppColors.deepForest,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      t('payment_calc_subtitle'),
                      style: TextStyle(
                        color: isDark ? Colors.white54 : Colors.black54,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : AppTheme.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.10)
                    : AppTheme.primary.withValues(alpha: 0.12),
              ),
            ),
            child: Text(
              t(
                breakdown.isExample
                    ? 'payment_calc_example_badge'
                    : 'payment_calc_from_payment_badge',
              ),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: isDark ? AppTheme.primaryLight : AppTheme.primary,
              ),
            ),
          ),
          const SizedBox(height: 18),
          _buildPaymentQuantityRow(
            context,
            label: t('payment_milk_quantity'),
            value: '${qtyLabel(breakdown.quantity)} L',
          ),
          const SizedBox(height: 16),
          _buildPaymentStep(
            context,
            title: t('payment_base_milk_title'),
            example: t(
              'payment_base_milk_line',
              params: {
                'qty': qtyLabel(breakdown.quantity),
                'rate': money(breakdown.baseRate),
                'amount': money(breakdown.basePayment),
              },
            ),
          ),
          _buildPaymentStep(
            context,
            title: t('payment_fat_bonus_title'),
            description: t('payment_fat_bonus_desc'),
            example: t(
              'payment_fat_bonus_line',
              params: {'amount': money(breakdown.fatBonus)},
            ),
          ),
          _buildPaymentStep(
            context,
            title: t('payment_snf_bonus_title'),
            description: t('payment_snf_bonus_desc'),
            example: t(
              'payment_snf_bonus_line',
              params: {'amount': money(breakdown.snfBonus)},
            ),
          ),
          _buildPaymentStep(
            context,
            title: t('payment_final_title'),
            description: t('payment_final_desc'),
            example: t(
              'payment_final_line',
              params: {
                'base': money(breakdown.basePayment),
                'fat': money(breakdown.fatBonus),
                'snf': money(breakdown.snfBonus),
                'total': money(breakdown.finalPayment),
              },
            ),
            highlight: true,
          ),
          _buildPaymentStep(
            context,
            title: t('payment_biweekly_title'),
            description: t('payment_biweekly_desc'),
            example: t('payment_biweekly_line'),
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.05)
                  : AppTheme.primary.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.08)
                    : AppTheme.primary.withValues(alpha: 0.10),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  LucideIcons.info,
                  size: 16,
                  color: isDark ? Colors.white60 : AppTheme.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    t('payment_calc_note'),
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.45,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white70 : Colors.black87,
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

  Widget _buildPaymentQuantityRow(
    BuildContext context, {
    required String label,
    required String value,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade200,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white70 : Colors.black87,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: isDark ? Colors.white : AppColors.deepForest,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentStep(
    BuildContext context, {
    required String title,
    String? description,
    required String example,
    bool highlight = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: highlight
              ? (isDark
                  ? AppTheme.primary.withValues(alpha: 0.12)
                  : AppTheme.primary.withValues(alpha: 0.06))
              : (isDark ? Colors.black26 : Colors.white),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: highlight
                ? AppTheme.primary.withValues(alpha: isDark ? 0.22 : 0.14)
                : (isDark
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.grey.shade200),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w900,
                color: isDark ? Colors.white : AppColors.deepForest,
              ),
            ),
            if (description != null) ...[
              const SizedBox(height: 6),
              Text(
                description,
                style: TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.white60 : Colors.black54,
                ),
              ),
            ],
            const SizedBox(height: 10),
            Text(
              example,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                height: 1.45,
                color: highlight
                    ? (isDark ? AppTheme.primaryLight : AppTheme.primary)
                    : (isDark ? Colors.white : const Color(0xFF1E293B)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentExplanationBreakdown {
  final bool isExample;
  final double quantity;
  final double baseRate;
  final double basePayment;
  final double fatBonus;
  final double snfBonus;
  final double finalPayment;

  const _PaymentExplanationBreakdown({
    required this.isExample,
    required this.quantity,
    required this.baseRate,
    required this.basePayment,
    required this.fatBonus,
    required this.snfBonus,
    required this.finalPayment,
  });

  static const _templateQty = 150.0;
  static const _templateBaseRate = 80.0;
  static const _templateBase = 12000.0;
  static const _templateFat = 450.0;
  static const _templateSnf = 240.0;
  static const _templateFinal = 12690.0;

  static _PaymentExplanationBreakdown fromPayments(
    List<dynamic> payments,
    List<dynamic> collections,
  ) {
    const template = _PaymentExplanationBreakdown(
      isExample: true,
      quantity: _templateQty,
      baseRate: _templateBaseRate,
      basePayment: _templateBase,
      fatBonus: _templateFat,
      snfBonus: _templateSnf,
      finalPayment: _templateFinal,
    );

    dynamic paid;
    for (final p in payments) {
      final status = (p['status'] ?? '').toString().toLowerCase();
      if (status == 'paid') {
        paid = p;
        break;
      }
    }
    if (paid == null) return template;

    final amount = double.tryParse(paid['amount']?.toString() ?? '');
    var qty = double.tryParse(paid['quantity']?.toString() ?? '');
    if (amount == null || amount <= 0) return template;

    if (qty == null || qty <= 0) {
      final cid = paid['collectionId']?.toString();
      if (cid != null) {
        for (final c in collections) {
          if (c['id']?.toString() == cid) {
            qty = double.tryParse(c['quantity']?.toString() ?? '');
            break;
          }
        }
      }
    }
    if (qty == null || qty <= 0) return template;

    final scale = amount / _templateFinal;
    final basePayment = _templateBase * scale;
    final fatBonus = _templateFat * scale;
    final snfBonus = _templateSnf * scale;
    final baseRate = basePayment / qty;

    return _PaymentExplanationBreakdown(
      isExample: false,
      quantity: qty,
      baseRate: baseRate,
      basePayment: basePayment,
      fatBonus: fatBonus,
      snfBonus: snfBonus,
      finalPayment: amount,
    );
  }
}