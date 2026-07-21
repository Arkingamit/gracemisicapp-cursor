package org.graceahmedabad.music;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Parcelable;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Small helpers for the Grace Music Android shell (settings deep-links, PDF open, etc.).
 */
@CapacitorPlugin(name = "GraceApp")
public class GraceAppPlugin extends Plugin {

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Unable to open notification settings");
        }
    }

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        JSObject info = new JSObject();
        info.put("packageName", getContext().getPackageName());
        info.put("appName", getContext().getString(R.string.app_name));
        call.resolve(info);
    }

    /**
     * Open an exported PDF: PDF viewer apps are listed first, then share targets
     * (WhatsApp, Drive, etc.).
     *
     * Expects a cache-relative {@code path} (e.g. {@code songs-set.pdf}) and/or a
     * {@code file://} / content {@code uri} from Capacitor Filesystem.
     */
    @PluginMethod
    public void openPdf(PluginCall call) {
        try {
            String path = call.getString("path");
            String uriString = call.getString("uri");
            String title = call.getString("title", "Open PDF");

            File file = resolvePdfFile(path, uriString);
            if (file == null || !file.exists()) {
                call.reject("PDF file not found");
                return;
            }

            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(contentUri, "application/pdf");
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/pdf");
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            grantUriToResolvers(viewIntent, contentUri);
            grantUriToResolvers(shareIntent, contentUri);

            // Main chooser = share targets; INITIAL_INTENTS (PDF viewers) appear first.
            Intent chooser = Intent.createChooser(shareIntent, "Open PDF with");
            ArrayList<Parcelable> viewerIntents = buildViewerIntents(viewIntent, contentUri);
            if (!viewerIntents.isEmpty()) {
                chooser.putExtra(
                    Intent.EXTRA_INITIAL_INTENTS,
                    viewerIntents.toArray(new Parcelable[0])
                );
            }

            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Unable to open PDF");
        }
    }

    private File resolvePdfFile(String path, String uriString) {
        if (path != null && !path.isEmpty()) {
            // Capacitor Filesystem Cache writes under the app cache dir
            File cached = new File(getContext().getCacheDir(), path);
            if (cached.exists()) {
                return cached;
            }
            // Also try external cache
            File ext = getContext().getExternalCacheDir();
            if (ext != null) {
                File externalCached = new File(ext, path);
                if (externalCached.exists()) {
                    return externalCached;
                }
            }
        }

        if (uriString != null && !uriString.isEmpty()) {
            Uri parsed = Uri.parse(uriString);
            String filePath = parsed.getPath();
            if (filePath != null) {
                File fromUri = new File(filePath);
                if (fromUri.exists()) {
                    return fromUri;
                }
            }
        }

        return null;
    }

    private ArrayList<Parcelable> buildViewerIntents(Intent viewIntent, Uri contentUri) {
        ArrayList<Parcelable> intents = new ArrayList<>();
        PackageManager pm = getContext().getPackageManager();
        int flags = PackageManager.MATCH_DEFAULT_ONLY;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PackageManager.MATCH_ALL;
        }

        List<ResolveInfo> viewers = pm.queryIntentActivities(viewIntent, flags);
        String ourPackage = getContext().getPackageName();

        for (ResolveInfo info : viewers) {
            if (info.activityInfo == null) continue;
            String pkg = info.activityInfo.packageName;
            if (ourPackage.equals(pkg)) continue;

            Intent target = new Intent(viewIntent);
            target.setPackage(pkg);
            target.setClassName(pkg, info.activityInfo.name);
            target.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().grantUriPermission(pkg, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intents.add(target);
        }
        return intents;
    }

    private void grantUriToResolvers(Intent intent, Uri contentUri) {
        PackageManager pm = getContext().getPackageManager();
        List<ResolveInfo> list = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
        for (ResolveInfo info : list) {
            if (info.activityInfo == null) continue;
            getContext().grantUriPermission(
                info.activityInfo.packageName,
                contentUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        }
    }
}
