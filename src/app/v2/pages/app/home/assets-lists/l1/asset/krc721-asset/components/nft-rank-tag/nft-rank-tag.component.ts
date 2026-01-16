import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-nft-rank-tag',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './nft-rank-tag.component.html',
    styleUrl: './nft-rank-tag.component.scss',
})
export class NftRankTagComponent {
    rarityRank = input<number>(0);
    totalSupply = input<number>(0);
    isLegendary = input<boolean>(false);
    size = input<'xs' | 'sm' | 'md' | 'lg'>('sm');


    rarityType = computed(() => {
        // If we don't have rank or supply, we default to neutral.
        // Note: Source checked !this.totalSupply() || !this.rarityRank()
        // But rank can be 0 or negative (legendary).
        // Source: if (!this.totalSupply() || !this.rarityRank()) return NEUTRAL;
        // Actually source `if (!this.totalSupply() || !this.rarityRank())` 
        // If rank is 0, !0 is true. So rank 0 returns neutral?
        // If rank is expected to be >= 1 usually.
        // Let's copy source logic exactly.
        if (!this.totalSupply() || !this.rarityRank())
            return 'neutral';

        const maxNfts = this.totalSupply();
        const rank = this.rarityRank();

        if (this.isLegendary() || rank < 0) return 'legendary';
        if (rank <= maxNfts * 0.01) return 'gold'; // Top 1%
        if (rank <= maxNfts * 0.1) return 'silver'; // Top 10%
        if (rank <= maxNfts * 0.3) return 'bronze'; // Top 30%
        return 'neutral'; // Remaining 70%
    });

    tagLabel = computed(() => {
        if (this.rarityType() === 'legendary') {
            return 'Legendary';
        }
        // formatting "Rank: #123"
        return `Rank: #${this.rarityRank()}`;
    });
}
