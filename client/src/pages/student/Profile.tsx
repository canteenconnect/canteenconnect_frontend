import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/student/ProfileForm";
import { useStudentContext } from "@/context/StudentContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { studentApi, type StudentProfileUpdateInput } from "@/lib/api/studentApi";

export default function ProfilePage() {
  const { user } = useAuth();
  const { profile, isLoading, refreshAll } = useStudentContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({
      payload,
      file,
    }: {
      payload: StudentProfileUpdateInput;
      file: File | null;
    }) => {
      if (!file) {
        return studentApi.updateProfile(payload);
      }

      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          formData.append(key, String(value));
        }
      });
      formData.append("profile_image", file);
      return studentApi.updateProfile(formData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["student"] });
      await refreshAll();
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Profile update failed",
        description: "Please check the values and try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl bg-zinc-800" />
        <Skeleton className="h-72 rounded-2xl bg-zinc-800" />
      </div>
    );
  }

  const nowIso = new Date().toISOString();
  const resolvedProfile =
    profile ??
    (user?.role === "student"
      ? {
          id: user.id,
          fullName: user.fullName ?? user.name ?? user.username ?? "Student",
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          collegeId: user.collegeId ?? null,
          department: user.department ?? null,
          profileImage: user.profileImage ?? null,
          dietaryPreference: user.dietaryPreference,
          createdAt: user.createdAt ?? nowIso,
          updatedAt: user.updatedAt ?? nowIso,
        }
      : null);

  if (!resolvedProfile) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="p-6 text-sm text-zinc-400">
          Student profile could not be loaded.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Profile</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Manage Student Profile</h2>
      </section>

      <ProfileForm
        profile={resolvedProfile}
        isSaving={updateMutation.isPending}
        onSubmit={(payload, file) => updateMutation.mutate({ payload, file })}
      />
    </div>
  );
}
