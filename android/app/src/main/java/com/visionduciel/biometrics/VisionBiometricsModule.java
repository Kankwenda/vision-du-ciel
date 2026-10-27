package com.visionduciel.biometrics;

import android.app.Activity;
import android.content.DialogInterface;
import android.content.pm.PackageManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Module natif d'empreinte pour Vision du Ciel.
 * Limite honnête de la plateforme Android : le capteur ne révèle jamais
 * l'identité du doigt ni les empreintes enregistrées. Il confirme seulement
 * que le doigt posé est celui du propriétaire du téléphone.
 * Ce module ne fait donc qu'une chose : confirmer le propriétaire.
 */
public class VisionBiometricsModule extends ReactContextBaseJavaModule {

    public VisionBiometricsModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "VisionBiometrics";
    }

    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT < 28) {
                promise.resolve(false);
                return;
            }
            Activity activity = getCurrentActivity();
            if (activity == null) {
                promise.resolve(false);
                return;
            }
            if (!activity.getPackageManager().hasSystemFeature(
                    PackageManager.FEATURE_FINGERPRINT)) {
                promise.resolve(false);
                return;
            }
            if (Build.VERSION.SDK_INT >= 29) {
                BiometricManager bm = (BiometricManager) activity.getSystemService(
                        BiometricManager.class);
                promise.resolve(
                        bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS);
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("ERR", e.getMessage());
        }
    }

    @ReactMethod
    public void authenticate(Promise promise) {
        final AtomicBoolean settled = new AtomicBoolean(false);
        try {
            final Activity activity = getCurrentActivity();
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "Aucune activité");
                return;
            }
            Executor executor = activity.getMainExecutor();
            BiometricPrompt prompt = new BiometricPrompt.Builder(activity)
                    .setTitle("Vision du Ciel")
                    .setSubtitle("Identification par empreinte")
                    .setDescription("Posez le doigt du propriétaire du téléphone sur le capteur.")
                    .setNegativeButton("Annuler", executor,
                            new DialogInterface.OnClickListener() {
                                @Override
                                public void onClick(DialogInterface dialog, int which) {
                                    if (settled.compareAndSet(false, true)) {
                                        promise.reject("CANCELLED", "Annulé");
                                    }
                                }
                            })
                    .build();
            CancellationSignal signal = new CancellationSignal();
            prompt.authenticate(signal, executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(
                                BiometricPrompt.AuthenticationResult result) {
                            if (settled.compareAndSet(false, true)) {
                                promise.resolve("OWNER_CONFIRMED");
                            }
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            if (settled.compareAndSet(false, true)) {
                                promise.reject("NOT_RECOGNIZED", "Empreinte non reconnue");
                            }
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            if (!settled.compareAndSet(false, true)) {
                                return;
                            }
                            if (errorCode == BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED) {
                                promise.reject("CANCELLED", "Annulé");
                            } else if (errorCode == BiometricPrompt.BIOMETRIC_ERROR_NO_BIOMETRICS
                                    || errorCode == BiometricPrompt.BIOMETRIC_ERROR_HW_UNAVAILABLE) {
                                promise.reject("UNAVAILABLE", "Empreinte indisponible");
                            } else {
                                promise.reject("ERROR",
                                        errString != null ? errString.toString() : "Erreur");
                            }
                        }
                    });
        } catch (Exception e) {
            if (settled.compareAndSet(false, true)) {
                promise.reject("ERR", e.getMessage());
            }
        }
    }
}
