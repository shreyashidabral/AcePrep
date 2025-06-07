/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;

  try {
    const userRecord = await db.collection("users").doc(uid).get();

    if (userRecord.createTime) {
      return {
        success: false,
        message: "User akready exists. Please sign in instead",
      };
    }
    await db.collection("users").doc(uid).set({
      name: name,
      email: email,
    });

    return {
      success: true,
      message: 'Account created successfully. Please sign in.'
    }
  } catch (error: any) {
    console.error("Error creating a user", error);

    if (error.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return {
      success: false,
      message: "Failed to create an account",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken } = params;

  try {
    // Verify the ID token to confirm it is valid and get the decoded token info
    const decodedToken = await auth.verifyIdToken(idToken);

    if (!decodedToken || !decodedToken.uid) {
      return {
        success: false,
        message: "Invalid authentication token. Please sign in again.",
      };
    }

    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord) {
      return {
        success: false,
        message: "User does not exist. Create an account instead.",
      };
    }
    await setSessionCookie(idToken);  
  } catch (error) {
    console.error(error);
  }
}

export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: ONE_WEEK,
  });

  cookieStore.set("session", sessionCookie, {
    maxAge: ONE_WEEK,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if(!sessionCookie) return null;

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    const userRecord = await db.collection('users').doc(decodedClaims.uid).get();
    if(!userRecord.exists) return null;

    return {
      ...userRecord.data(),
      id: userRecord.id
    } as User
  } catch (error) {
    console.log(error);
    //Return null either the session is invalid or expire
    return null;
  }
}

export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;  //convert truthy or falsy value to boolean variable
}