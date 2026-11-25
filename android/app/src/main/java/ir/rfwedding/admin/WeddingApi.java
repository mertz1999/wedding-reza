package ir.rfwedding.admin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class WeddingApi {
    static final String ORIGIN = "https://rf-wedding.ir";

    static final class SignInException extends IOException {}

    private WeddingApi() {}

    static List<Guest> guests(String username, String password) throws IOException, JSONException {
        URL url = new URL(ORIGIN + "/api/admin/invitations");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(15_000);
            connection.setRequestProperty("Accept", "application/json");
            String credentials = username + ":" + password;
            String encoded = Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
            connection.setRequestProperty("Authorization", "Basic " + encoded);
            int status = connection.getResponseCode();
            if (status == 401) throw new SignInException();
            if (status != 200) throw new IOException("HTTP " + status);

            try (InputStream stream = connection.getInputStream();
                 ByteArrayOutputStream body = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = stream.read(buffer)) != -1) {
                    body.write(buffer, 0, count);
                    if (body.size() > 8_000_000) throw new IOException("Guest list is too large");
                }
                return parseGuests(new String(body.toByteArray(), StandardCharsets.UTF_8));
            }
        } finally {
            connection.disconnect();
        }
    }

    static List<Guest> parseGuests(String body) throws JSONException {
        JSONArray list = new JSONObject(body).getJSONArray("invitations");
        List<Guest> guests = new ArrayList<>(list.length());
        for (int i = 0; i < list.length(); i++) {
            JSONObject row = list.getJSONObject(i);
            String token = row.getString("token");
            if (!token.matches("[A-Za-z0-9_-]+")) throw new JSONException("Invalid invitation token");
            guests.add(new Guest(row.getLong("id"), token, row.getString("guestName"),
                row.isNull("phone") ? "" : row.optString("phone"), row.isNull("rsvpStatus") ? "" : row.optString("rsvpStatus")));
        }
        return guests;
    }
}
