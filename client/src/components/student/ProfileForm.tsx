import { useEffect, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StudentProfile, StudentProfileUpdateInput } from "@/lib/api/studentApi";

const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(120),
  email: z.string().trim().email("Valid email required").or(z.literal("")),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[+]?[\d\s\-()]{7,20}$/, "Phone number format is invalid")
    .or(z.literal("")),
  collegeId: z.string().trim().max(64).or(z.literal("")),
  department: z.string().trim().max(128).or(z.literal("")),
  dietaryPreference: z.enum(["veg", "non-veg", "both"]),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type ProfileFormProps = {
  profile: StudentProfile;
  isSaving: boolean;
  onSubmit: (payload: StudentProfileUpdateInput, file: File | null) => void;
};

export function ProfileForm({ profile, isSaving, onSubmit }: ProfileFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: profile.fullName ?? "",
      email: profile.email ?? "",
      phoneNumber: profile.phoneNumber ?? "",
      collegeId: profile.collegeId ?? "",
      department: profile.department ?? "",
      dietaryPreference: profile.dietaryPreference,
    },
  });

  useEffect(() => {
    form.reset({
      fullName: profile.fullName ?? "",
      email: profile.email ?? "",
      phoneNumber: profile.phoneNumber ?? "",
      collegeId: profile.collegeId ?? "",
      department: profile.department ?? "",
      dietaryPreference: profile.dietaryPreference,
    });
    setSelectedFile(null);
    setFileError("");
  }, [form, profile]);

  const [previewImage, setPreviewImage] = useState("");

  useEffect(() => {
    if (!selectedFile) {
      setPreviewImage(profile.profileImage ?? "");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewImage(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [profile.profileImage, selectedFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileError("");
      return;
    }

    const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!supportedTypes.includes(file.type)) {
      setSelectedFile(null);
      setFileError("Only JPEG, PNG, or WEBP files are allowed.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSelectedFile(null);
      setFileError("Profile image must be under 2MB.");
      return;
    }

    setSelectedFile(file);
    setFileError("");
  };

  const submit = (values: ProfileFormValues) => {
    const payload: StudentProfileUpdateInput = {
      fullName: values.fullName,
      email: values.email || undefined,
      phoneNumber: values.phoneNumber || undefined,
      collegeId: values.collegeId || undefined,
      department: values.department || undefined,
      dietaryPreference: values.dietaryPreference,
    };

    onSubmit(payload, selectedFile);
  };

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20 border border-zinc-700">
          <AvatarImage src={previewImage} alt={profile.fullName} />
          <AvatarFallback className="bg-zinc-800 text-xl text-zinc-200">
            {profile.fullName.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800">
            <Camera className="h-4 w-4" />
            Upload Photo
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
          {fileError && <p className="mt-2 text-xs text-rose-400">{fileError}</p>}
        </div>
      </div>

      <Form {...form}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="text-zinc-300">Full Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-300">Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-300">Phone</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="collegeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-300">College ID</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-300">Department</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dietaryPreference"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="text-zinc-300">Dietary Preference</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100">
                      <SelectValue placeholder="Choose preference" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                    <SelectItem value="veg">Vegetarian</SelectItem>
                    <SelectItem value="non-veg">Non-Vegetarian</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={isSaving}
              className="h-11 w-full bg-zinc-100 text-zinc-950 hover:bg-white"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
