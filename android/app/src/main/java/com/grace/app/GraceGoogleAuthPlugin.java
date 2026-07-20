package com.grace.app;

import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import org.json.JSONObject;

/**
 * Dedicated Google ID-token sign-in for the Grace Music Android shell.
 * Avoids Capawesome's optional OAuth-scope authorization step that cancels
 * after account selection when the live website initializes with scopes.
 */
@CapacitorPlugin(name = "GraceGoogleAuth")
public class GraceGoogleAuthPlugin extends Plugin {

    private static final String WEB_CLIENT_ID =
        "810353645969-dmsbou0itk6475tap5j8qq7ejvs68dm7.apps.googleusercontent.com";

    @PluginMethod
    public void signIn(PluginCall call) {
        trySignIn(call, false);
    }

    private void trySignIn(PluginCall call, boolean useButtonFlow) {
        GetCredentialRequest request;
        if (useButtonFlow) {
            GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(WEB_CLIENT_ID)
                .setNonce(randomNonce())
                .build();
            request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        } else {
            GetGoogleIdOption option = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(WEB_CLIENT_ID)
                .setAutoSelectEnabled(false)
                .setNonce(randomNonce())
                .build();
            request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        }

        CredentialManager credentialManager = CredentialManager.create(getContext());
        credentialManager.getCredentialAsync(
            getActivity(),
            request,
            null,
            Runnable::run,
            new androidx.credentials.CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(@NonNull GetCredentialResponse response) {
                    handleSuccess(call, response);
                }

                @Override
                public void onError(@NonNull GetCredentialException e) {
                    if (!useButtonFlow && (e instanceof NoCredentialException || e instanceof GetCredentialCancellationException)) {
                        // Fallback to the explicit Sign in with Google button flow
                        new Handler(Looper.getMainLooper()).post(() -> trySignIn(call, true));
                        return;
                    }
                    if (e instanceof GetCredentialCancellationException) {
                        // Google often reports "canceled" when the Android SHA-1 / OAuth client is missing
                        call.reject(
                            "Google Sign-In canceled (often means Android SHA-1 is not registered in Firebase). " +
                                (e.getMessage() != null ? e.getMessage() : ""),
                            "SIGN_IN_CANCELED"
                        );
                        return;
                    }
                    String detail = e.getClass().getSimpleName();
                    if (e.getMessage() != null && !e.getMessage().isEmpty()) {
                        detail += ": " + e.getMessage();
                    }
                    call.reject(detail);
                }
            }
        );
    }

    private void handleSuccess(PluginCall call, GetCredentialResponse response) {
        try {
            Credential credential = response.getCredential();
            if (!(credential instanceof CustomCredential)) {
                call.reject("Unexpected credential type");
                return;
            }
            CustomCredential custom = (CustomCredential) credential;
            if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType())) {
                call.reject("Unexpected Google credential type");
                return;
            }

            GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(custom.getData());
            String idToken = googleCredential.getIdToken();
            if (idToken == null || idToken.isEmpty()) {
                call.reject("Google did not return an ID token");
                return;
            }

            JSObject result = new JSObject();
            result.put("idToken", idToken);
            result.put("email", googleCredential.getId());
            result.put("displayName", googleCredential.getDisplayName());
            result.put("givenName", googleCredential.getGivenName());
            result.put("familyName", googleCredential.getFamilyName());
            if (googleCredential.getProfilePictureUri() != null) {
                result.put("imageUrl", googleCredential.getProfilePictureUri().toString());
            }

            // Also expose JWT claims used by the website's login fallback
            try {
                String[] parts = idToken.split("\\.");
                if (parts.length >= 2) {
                    byte[] decoded = Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
                    JSONObject payload = new JSONObject(new String(decoded, StandardCharsets.UTF_8));
                    if (payload.has("sub")) result.put("sub", payload.getString("sub"));
                    if (payload.has("email")) result.put("email", payload.getString("email"));
                    if (payload.has("name")) result.put("name", payload.getString("name"));
                }
            } catch (Exception ignored) {
                // optional claims
            }

            call.resolve(result);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Failed to parse Google credential");
        }
    }

    private static String randomNonce() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
