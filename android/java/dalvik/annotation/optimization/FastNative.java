package dalvik.annotation.optimization;

// Reference:
// - https://developer.android.com/ndk/guides/jni-tips
// - https://nickb.website/blog/speeding-up-your-android-apps-native-calls

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Retention(RetentionPolicy.CLASS)
@Target({ElementType.METHOD})
public @interface FastNative {}
