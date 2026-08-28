import Big from "big.js";

/**
 * Stripe and Postgres store integer cents. Decay is `0.5^(age / half-life)`;
 * Big.pow only takes integer exponents, so that factor stays IEEE. Every ratio
 * afterwards — ceiling `1.6/n`, live/total, water-fill — is Big.js, so a share
 * is never `0.1 + 0.2` in IEEE.
 */
Big.DP = 24;
Big.RM = Big.roundHalfUp;

export { Big };
