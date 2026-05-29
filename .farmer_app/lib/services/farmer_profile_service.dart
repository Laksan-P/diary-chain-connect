import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/offline_service.dart';

/// Shared profile fetch/update — preserves existing PATCH payload and offline queue.
class FarmerProfileService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> fetchDetails(AuthProvider auth) async {
    if (auth.user == null) return {};
    if (!OfflineService().isOnline) {
      return Map<String, dynamic>.from(auth.user!);
    }
    final res = await _api.get(
      '/farmers?action=get&id=${auth.user!['farmerId']}',
    );
    return Map<String, dynamic>.from(res as Map);
  }

  Future<void> updateProfile({
    required AuthProvider auth,
    required Map<String, String> personal,
    required Map<String, String> bank,
  }) async {
    final farmerId = auth.user?['farmerId'];
    final updateData = {
      'name': personal['name'] ?? '',
      'address': personal['address'] ?? '',
      'phone': personal['phone'] ?? '',
      'nic': personal['nic'] ?? '',
      'bank_name': bank['bank_name'] ?? '',
      'account_number': bank['account_number'] ?? '',
      'branch': bank['branch'] ?? '',
    };

    if (!OfflineService().isOnline) {
      await OfflineService().addPendingAction(
        '/farmers?action=update&id=$farmerId',
        'PATCH',
        updateData,
      );
      auth.updateLocalUser({
        'name': updateData['name'],
        'address': updateData['address'],
        'phone': updateData['phone'],
        'nic': updateData['nic'],
        'bankName': updateData['bank_name'],
        'accountNumber': updateData['account_number'],
        'branch': updateData['branch'],
      });
      return;
    }

    await _api.patch('/farmers?action=update&id=$farmerId', updateData);
    await auth.checkAuth();
  }
}
