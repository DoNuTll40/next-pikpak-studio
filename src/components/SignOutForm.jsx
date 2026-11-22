import { control } from "@/lib/ui-styles";
import { signOut } from "@/app/login/actions";

export function SignOutForm({ className }) {
  return (
    <form action={signOut} className={className}>
      <button type="submit" className={control}>ออกจากระบบ</button>
    </form>
  );
}
