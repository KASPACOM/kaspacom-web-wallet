import { Injectable } from "@angular/core";
import { ethers } from "ethers";
import { environment } from "../../../environments/environment";
import { BaseL2Service } from "./base-l2.service";


@Injectable({
  providedIn: 'root',
})
export class KasplexL2Service extends BaseL2Service {
  constructor() {
    super(environment.l2Configs.kasplex);
  }
}
