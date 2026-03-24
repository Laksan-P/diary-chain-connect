import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  static String get baseUrl {
  return 'https://diary-chain-connect.vercel.app/api';
}

  final storage = const FlutterSecureStorage();

  Future<String?> getToken() async {
    return await storage.read(key: 'auth_token');
  }

  Future<Map<String, String>> getHeaders() async {
    String? token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: await getHeaders(),
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  Future<dynamic> get(String path) async {
    final response = await http.get(
      Uri.parse('$baseUrl$path'),
      headers: await getHeaders(),
    );
    return _handleResponse(response);
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final response = await http.patch(
      Uri.parse('$baseUrl$path'),
      headers: await getHeaders(),
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  Future<dynamic> put(String path, Map<String, dynamic> body) async {
    final response = await http.put(
      Uri.parse('$baseUrl$path'),
      headers: await getHeaders(),
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  Future<dynamic> delete(String path) async {
    final response = await http.delete(
      Uri.parse('$baseUrl$path'),
      headers: await getHeaders(),
    );
    return _handleResponse(response);
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    } else {
      final body = jsonDecode(response.body);
      throw Exception(
        body['error'] ?? 'Request failed: ${response.statusCode}',
      );
    }
  }
}
