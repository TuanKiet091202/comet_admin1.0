module.exports = {
   async headers() {
      return [
         {
            // Khớp tất cả các routes API
            source: "/api/:path*",
            headers: [
               { key: "Access-Control-Allow-Credentials", value: "true" },
               { key: "Access-Control-Allow-Origin", value: "https://comet-store.vercel.app" },
               { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
               { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Authorization, Content-Type" },
            ],
         },
      ];
   },
};