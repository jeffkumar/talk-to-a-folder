"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { PILOT_USER_LIMIT } from "@/lib/constants";
import {
  createPasswordResetToken,
  createUser,
  createUserWithHashedPassword,
  createWaitlistRequest,
  getPasswordResetToken,
  getUser,
  getUserCount,
  getWaitlistRequestByEmail,
  markPasswordResetTokenUsed,
  updateUserPassword,
} from "@/lib/db/queries";
import { generateHashedPassword } from "@/lib/db/utils";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email";

import { signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const waitlistFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  businessName: z.string().min(1),
  phoneNumber: z.string().min(1),
  address: z.string().min(1),
  country: z.string().min(1),
  state: z.string().optional(),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export type RequestWaitlistActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_data"
    | "already_exists"
    | "waitlisted";
};

export const requestWaitlist = async (
  _: RequestWaitlistActionState,
  formData: FormData
): Promise<RequestWaitlistActionState> => {
  try {
    const validatedData = waitlistFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
      businessName: formData.get("businessName"),
      phoneNumber: formData.get("phoneNumber"),
      address: formData.get("address"),
      country: formData.get("country"),
      state: formData.get("state") || undefined,
    });

    // Check if user already exists
    const [existingUser] = await getUser(validatedData.email);
    if (existingUser) {
      return { status: "already_exists" };
    }

    // Check if waitlist request already exists
    const existingRequest = await getWaitlistRequestByEmail(
      validatedData.email
    );
    if (existingRequest) {
      return { status: "already_exists" };
    }

    // Check if pilot is full
    const userCount = await getUserCount();
    const isPilotFull = userCount >= PILOT_USER_LIMIT;

    const waitlistEntry = await createWaitlistRequest({
      email: validatedData.email,
      password: validatedData.password,
      name: validatedData.name,
      businessName: validatedData.businessName,
      phoneNumber: validatedData.phoneNumber,
      address: validatedData.address,
      country: validatedData.country,
      state: validatedData.state,
    });

    // If pilot is full, don't auto-approve - user stays on waitlist
    if (isPilotFull) {
      return { status: "waitlisted" };
    }

    // Auto-approve: Create user account immediately with the hashed password
    if (waitlistEntry.password) {
      await createUserWithHashedPassword(
        waitlistEntry.email,
        waitlistEntry.password,
        waitlistEntry.name
      );
    }

    // Sign the user in
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    sendWelcomeEmail(validatedData.email, validatedData.name).catch(
      console.error
    );

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors);
      return { status: "invalid_data" };
    }

    console.error("Waitlist request error:", error);
    return { status: "failed" };
  }
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: "user_exists" } as RegisterActionState;
    }

    // Check if waitlist request exists and is approved
    const waitlistRequest = await getWaitlistRequestByEmail(
      validatedData.email
    );
    if (!waitlistRequest) {
      return { status: "failed" };
    }

    if (waitlistRequest.status !== "approved") {
      return { status: "failed" };
    }

    // Create user with the password and name from waitlist request
    await createUser(
      validatedData.email,
      validatedData.password,
      waitlistRequest.name
    );
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

// ── Password Reset ──────────────────────────────────────────────────

export type RequestPasswordResetActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const requestPasswordReset = async (
  _: RequestPasswordResetActionState,
  formData: FormData
): Promise<RequestPasswordResetActionState> => {
  try {
    const validatedData = z
      .object({ email: z.string().email() })
      .parse({ email: formData.get("email") });

    const [existingUser] = await getUser(validatedData.email);

    if (existingUser) {
      const token = await createPasswordResetToken(existingUser.id);
      const h = await headers();
      const host = h.get("host") ?? "localhost:3000";
      const protocol = host.startsWith("localhost") ? "http" : "https";
      const resetUrl = `${protocol}://${host}/reset-password?token=${token}`;

      await sendPasswordResetEmail(existingUser.email, resetUrl);
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type ResetPasswordActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_data"
    | "invalid_token";
};

export const resetPassword = async (
  _: ResetPasswordActionState,
  formData: FormData
): Promise<ResetPasswordActionState> => {
  try {
    const validatedData = z
      .object({
        token: z.string().min(1),
        password: z.string().min(6),
      })
      .parse({
        token: formData.get("token"),
        password: formData.get("password"),
      });

    const resetToken = await getPasswordResetToken(validatedData.token);

    if (!resetToken) {
      return { status: "invalid_token" };
    }

    if (resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return { status: "invalid_token" };
    }

    const hashedPassword = generateHashedPassword(validatedData.password);
    await updateUserPassword(resetToken.userId, hashedPassword);
    await markPasswordResetTokenUsed(resetToken.id);

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};
