const redirUri = typeof window !== "undefined"
    ? window.location.origin + "/auth-callback"
    : process.env.NEXT_PUBLIC_REDIRECT_URI;

export const msalconfig = {
    auth: {
        clientId: "40bafd50-ad27-4b77-a8cd-0b43e911ee82",
        authority: "https://login.microsoftonline.com/organizations",
        redirectUri: redirUri,
    },
    cache: {
        cacheLocation: "sessionStorage", // This helps maintain session on refresh
        storeAuthStateInCookie: false,
    }
};

export const loginRequest = {
    scopes: ["User.Read"],
};