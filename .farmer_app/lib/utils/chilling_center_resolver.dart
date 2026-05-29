import '../services/offline_service.dart';

/// Resolves assigned chilling center from the farmer's registration assignment.
/// Uses [chillingCenterId] as the source of truth — never picks an arbitrary
/// collection center or stale cached name from another farmer.
class ChillingCenterResolver {
  static String? centerIdFromUser(Map<String, dynamic>? user) {
    if (user == null) return null;
    final id = user['chillingCenterId']?.toString().trim();
    if (id != null && id.isNotEmpty) return id;
    return null;
  }

  static String? centerIdFromFarmerRecord(Map<String, dynamic>? farmerRecord) {
    if (farmerRecord == null) return null;
    final id = farmerRecord['chillingCenterId']?.toString().trim();
    if (id != null && id.isNotEmpty) return id;
    return null;
  }

  static String? nameForCenterId(
    String centerId, {
    List<dynamic>? centers,
  }) {
    final cached = centers ?? OfflineService().getCachedData('chilling_centers');
    if (cached is! List) return null;

    for (final center in cached) {
      if (center is! Map) continue;
      if (center['id']?.toString() == centerId) {
        final name = center['name']?.toString().trim();
        if (name != null && name.isNotEmpty) return name;
      }
    }
    return null;
  }

  static String? fromOfflineCache(Map<String, dynamic>? user) {
    final ccId = centerIdFromUser(user);
    if (ccId == null) return null;
    return nameForCenterId(ccId);
  }

  static String? fromFarmerRecord(Map<String, dynamic>? farmerData) {
    if (farmerData == null) return null;
    final name = farmerData['chillingCenterName']?.toString().trim();
    if (name != null && name.isNotEmpty) return name;
    final ccId = centerIdFromFarmerRecord(farmerData);
    if (ccId == null) return null;
    return nameForCenterId(ccId);
  }

  static String? fromCollections(
    List<dynamic> collections, {
    String? centerId,
    String? farmerId,
  }) {
    for (final c in collections) {
      if (c is! Map) continue;

      if (farmerId != null && farmerId.isNotEmpty) {
        final collectionFarmerId =
            c['farmerId']?.toString() ?? c['farmer_id']?.toString();
        if (collectionFarmerId != null &&
            collectionFarmerId.isNotEmpty &&
            collectionFarmerId != farmerId) {
          continue;
        }
      }

      if (centerId != null && centerId.isNotEmpty) {
        final collectionCenterId = c['chillingCenterId']?.toString() ??
            c['chilling_center_id']?.toString();
        if (collectionCenterId != null &&
            collectionCenterId.isNotEmpty &&
            collectionCenterId != centerId) {
          continue;
        }
      }

      final name = c['chillingCenterName']?.toString().trim();
      if (name != null && name.isNotEmpty) return name;
    }
    return null;
  }

  static List<dynamic> collectionsForFarmer(
    List<dynamic> collections,
    String? farmerId,
  ) {
    if (farmerId == null || farmerId.isEmpty) return collections;
    return collections.where((c) {
      if (c is! Map) return false;
      final collectionFarmerId =
          c['farmerId']?.toString() ?? c['farmer_id']?.toString();
      return collectionFarmerId == null ||
          collectionFarmerId.isEmpty ||
          collectionFarmerId == farmerId;
    }).toList();
  }

  /// Priority: assigned center ID lookup → farmer record → filtered collections
  /// → stored user name only when it matches the assigned center ID.
  static String? resolve({
    Map<String, dynamic>? user,
    List<dynamic> collections = const [],
    Map<String, dynamic>? farmerRecord,
  }) {
    final farmerId = user?['farmerId']?.toString();
    final scopedCollections = collectionsForFarmer(collections, farmerId);

    final centerId = centerIdFromUser(user) ??
        centerIdFromFarmerRecord(farmerRecord);

    if (centerId != null) {
      final fromLookup = nameForCenterId(centerId);
      if (fromLookup != null) return fromLookup;
    }

    final farmerName = fromFarmerRecord(farmerRecord);
    if (farmerName != null) return farmerName;

    final fromCollectionsName = fromCollections(
      scopedCollections,
      centerId: centerId,
      farmerId: farmerId,
    );
    if (fromCollectionsName != null) return fromCollectionsName;

    final storedName = user?['chillingCenterName']?.toString().trim();
    if (storedName != null && storedName.isNotEmpty) {
      if (centerId == null) return storedName;
      final expected = nameForCenterId(centerId);
      if (expected == null || expected == storedName) return storedName;
    }

    return fromOfflineCache(user);
  }
}
