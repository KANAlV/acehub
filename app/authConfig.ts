export const msalconfig = {
    auth: {
        clientId: "40bafd50-ad27-4b77-a8cd-0b43e911ee82",
        authority: "https://login.microsoftonline.com/organizations",
        redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/auth-callback",
    },
    cache: {
        cacheLocation: "localStorage", 
        storeAuthStateInCookie: true,
    }
};

export const loginRequest = {
    scopes: ["User.Read"],
};
