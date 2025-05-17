/**
 * Client for interacting with Digital Ocean API
 * Used for creating and managing GPU droplets for video transcoding
 */
export class DigitalOceanClient {
  private token: string;
  private baseUrl = 'https://api.digitalocean.com/v2';
  
  constructor(config: { token: string }) {
    if (!config.token) {
      throw new Error('Digital Ocean API token is required');
    }
    this.token = config.token;
  }
  
  /**
   * Create a new droplet
   */
  async createDroplet(params: {
    name: string;
    region: string;
    size: string;
    image: string;
    ssh_keys?: string[];
    backups?: boolean;
    ipv6?: boolean;
    user_data?: string;
    private_networking?: boolean;
    volumes?: string[];
    tags?: string[];
  }): Promise<{ id: number; name: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/droplets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create droplet: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        id: data.droplet.id,
        name: data.droplet.name
      };
    } catch (error: any) {
      console.error('Error creating Digital Ocean droplet:', error);
      throw error;
    }
  }
  
  /**
   * Get droplet details
   */
  async getDroplet(dropletId: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/droplets/${dropletId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get droplet: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.droplet;
    } catch (error: any) {
      console.error(`Error getting Digital Ocean droplet ${dropletId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a droplet
   */
  async deleteDroplet(dropletId: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/droplets/${dropletId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete droplet: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error(`Error deleting Digital Ocean droplet ${dropletId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all droplets
   */
  async getDroplets(tagName?: string): Promise<any[]> {
    try {
      const url = tagName 
        ? `${this.baseUrl}/droplets?tag_name=${encodeURIComponent(tagName)}` 
        : `${this.baseUrl}/droplets`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get droplets: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.droplets || [];
    } catch (error: any) {
      console.error('Error getting Digital Ocean droplets:', error);
      throw error;
    }
  }
  
  /**
   * Shutdown a droplet
   */
  async shutdownDroplet(dropletId: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/droplets/${dropletId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          type: 'shutdown'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to shutdown droplet: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error(`Error shutting down Digital Ocean droplet ${dropletId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get available regions
   */
  async getRegions(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/regions`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get regions: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.regions || [];
    } catch (error: any) {
      console.error('Error getting Digital Ocean regions:', error);
      throw error;
    }
  }
  
  /**
   * Get available sizes
   */
  async getSizes(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/sizes`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get sizes: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.sizes || [];
    } catch (error: any) {
      console.error('Error getting Digital Ocean sizes:', error);
      throw error;
    }
  }
  
  /**
   * Get available images
   */
  async getImages(type: 'distribution' | 'application' | 'private' = 'distribution'): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/images?type=${type}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get images: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.images || [];
    } catch (error: any) {
      console.error('Error getting Digital Ocean images:', error);
      throw error;
    }
  }
  
  /**
   * Get SSH keys
   */
  async getSSHKeys(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/account/keys`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get SSH keys: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.ssh_keys || [];
    } catch (error: any) {
      console.error('Error getting Digital Ocean SSH keys:', error);
      throw error;
    }
  }
} 